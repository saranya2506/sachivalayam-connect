import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/AppShell";
import { toast } from "sonner";
import { updateComplaintStatus, assignComplaint } from "@/lib/api/sachivalayam.functions";

export const Route = createFileRoute("/_authenticated/complaints/$id")({ component: ComplaintDetail });

interface ComplaintRow {
  id: string; complaint_number: string; title: string; category: string; description: string;
  location: string; photo_url: string | null; status: string; created_at: string;
  citizen_id: string; assigned_officer_id: string | null; assigned_admin_id: string | null;
  department: string | null; last_remark: string | null;
}
interface TimelineRow { id: string; status: string; remarks: string | null; created_at: string; updated_by: string | null }
interface OfficerOpt { user_id: string; department: string; full_name: string }

function ComplaintDetail() {
  const { id } = useParams({ from: "/_authenticated/complaints/$id" });
  const { user, role } = useAuth();
  const [c, setC] = useState<ComplaintRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [citizenName, setCitizenName] = useState("");
  const [officerName, setOfficerName] = useState("");
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [officers, setOfficers] = useState<OfficerOpt[]>([]);
  const [assignTo, setAssignTo] = useState("");
  const [statusForm, setStatusForm] = useState({ status: "", remarks: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("complaints").select("*").eq("id", id).maybeSingle();
    setC(data as ComplaintRow);
    if (data) {
      const { data: tl } = await supabase.from("complaint_timeline").select("*").eq("complaint_id", id).order("created_at", { ascending: true });
      setTimeline((tl as TimelineRow[]) ?? []);
      const { data: cit } = await supabase.from("profiles").select("full_name").eq("id", data.citizen_id).maybeSingle();
      setCitizenName(cit?.full_name ?? "");
      if (data.assigned_officer_id) {
        const { data: off } = await supabase.from("profiles").select("full_name").eq("id", data.assigned_officer_id).maybeSingle();
        setOfficerName(off?.full_name ?? "");
      }
      if (data.photo_url) {
        const { data: signed } = await supabase.storage.from("complaint-photos").createSignedUrl(data.photo_url, 60 * 60);
        setPhotoSrc(signed?.signedUrl ?? null);
      }
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    if (role !== "admin" && role !== "government_authority") return;
    (async () => {
      const { data: o, error } = await supabase.from("officers").select("user_id,department").eq("active", true);
      console.log("[officers dropdown] fetch", { count: o?.length ?? 0, error: error?.message });
      const ids = (o ?? []).map((x) => x.user_id);
      if (!ids.length) { setOfficers([]); return; }
      const { data: p } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const map: Record<string, string> = {}; p?.forEach((x) => { map[x.id] = x.full_name; });
      const opts = (o ?? []).map((x) => ({ user_id: x.user_id, department: x.department, full_name: map[x.user_id] ?? "(unnamed)" }));
      console.log("[officers dropdown] ready", opts);
      setOfficers(opts);
    })();
  }, [role]);

  if (!c) return <div className="text-muted-foreground">Loading…</div>;

  const canAdmin = role === "admin";
  const canOfficer = role === "officer" && c.assigned_officer_id === user?.id;

  const doAssign = async () => {
    if (!assignTo) return toast.error("Pick an officer");
    setBusy(true);
    try { await assignComplaint({ data: { complaintId: c.id, officerId: assignTo, remarks: statusForm.remarks || undefined } }); toast.success("Assigned"); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };
  const doStatus = async () => {
    if (!statusForm.status) return toast.error("Pick a status");
    setBusy(true);
    try { await updateComplaintStatus({ data: { complaintId: c.id, status: statusForm.status as never, remarks: statusForm.remarks || undefined } }); toast.success("Status updated"); setStatusForm({ status: "", remarks: "" }); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const nextStatuses: Record<string, string[]> = {
    submitted: ["assigned"], assigned: ["under_review", "rejected"],
    under_review: ["in_progress", "rejected"], in_progress: ["resolved"], resolved: [], rejected: [],
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Complaint</div>
          <h1 className="font-mono text-2xl font-bold">{c.complaint_number}</h1>
        </div>
        <StatusBadge status={c.status} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">{c.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground capitalize">{c.category.replace(/_/g, " ")} · {c.location}</p>
          <p className="mt-4 text-sm whitespace-pre-wrap">{c.description}</p>
          {photoSrc && <img src={photoSrc} alt="" className="mt-4 max-h-96 rounded border" />}
        </div>
        <div className="rounded-lg border bg-card p-6 text-sm space-y-2">
          <div><span className="text-muted-foreground">Submitted:</span> {new Date(c.created_at).toLocaleString()}</div>
          <div><span className="text-muted-foreground">Citizen:</span> {citizenName}</div>
          <div><span className="text-muted-foreground">Officer:</span> {officerName || "—"}</div>
          <div><span className="text-muted-foreground">Department:</span> {c.department ?? "—"}</div>
          {c.last_remark && <div><span className="text-muted-foreground">Latest remark:</span> {c.last_remark}</div>}
        </div>
      </div>

      {(canAdmin || canOfficer || role === "government_authority") && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="font-semibold">Take action</h3>
          {(role === "admin" || role === "government_authority") && (() => {
            const canReassign = c.status === "submitted" || role === "government_authority" || c.assigned_admin_id === user?.id;
            if (!canReassign) {
              return <div className="text-sm text-muted-foreground">🔒 Already assigned by another admin. Only the original assigning admin or Government Authority can reassign.</div>;
            }
            return (
              <div className="space-y-2">
                <label className="block text-sm font-medium">{c.assigned_officer_id ? "Reassign officer" : "Assign to officer"}</label>
                <div className="flex flex-wrap gap-2">
                  <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
                    <option value="">Select officer… ({officers.length})</option>
                    {officers.map((o) => <option key={o.user_id} value={o.user_id}>{o.full_name} — {o.department}</option>)}
                  </select>
                  <input placeholder="Remarks (optional)" value={statusForm.remarks} onChange={(e) => setStatusForm({ ...statusForm, remarks: e.target.value })} className="min-w-[200px] flex-1 rounded-md border bg-background px-3 py-2 text-sm" />
                  <button onClick={doAssign} disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{c.assigned_officer_id ? "Reassign" : "Assign"}</button>
                </div>
              </div>
            );
          })()}
          {(canOfficer || canAdmin) && nextStatuses[c.status]?.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Update status</label>
              <div className="flex flex-wrap gap-2">
                <select value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })} className="rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="">Pick a status…</option>
                  {nextStatuses[c.status].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
                <input placeholder="Remarks" value={statusForm.remarks} onChange={(e) => setStatusForm({ ...statusForm, remarks: e.target.value })} className="min-w-[200px] flex-1 rounded-md border bg-background px-3 py-2 text-sm" />
                <button onClick={doStatus} disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">Update</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 font-semibold">Timeline</h3>
        <ol className="relative border-s pl-6">
          {timeline.map((t) => (
            <li key={t.id} className="mb-5 last:mb-0">
              <div className="absolute -start-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
              <div className="text-sm font-semibold capitalize">{t.status.replace(/_/g, " ")}</div>
              {t.remarks && <div className="text-sm text-muted-foreground">{t.remarks}</div>}
              <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
            </li>
          ))}
        </ol>
      </div>
      <Link to="/" className="text-sm text-primary hover:underline">← Back</Link>
    </div>
  );
}

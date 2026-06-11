import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/AppShell";
import { toast } from "sonner";
import { decideAdminRegistration, toggleUserActive } from "@/lib/api/sachivalayam.functions";

export const Route = createFileRoute("/_authenticated/authority/admin-requests")({ component: AdminRequests });

interface Row {
  id: string; user_id: string; employee_id: string; district: string; mandal: string; village_ward: string;
  department: string; verification_status: string; created_at: string;
  full_name?: string; email?: string; mobile_number?: string; active_status?: boolean;
}

function AdminRequests() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("pending");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    let q = supabase.from("admin_registrations").select("*").order("created_at", { ascending: false });
    if (filter) q = q.eq("verification_status", filter as never);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setRows([]); return; }
    const regs = (data ?? []) as Row[];
    const ids = Array.from(new Set(regs.map((r) => r.user_id)));
    let profMap: Record<string, { full_name: string; email: string; mobile_number: string | null; active_status: boolean }> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles")
        .select("id,full_name,email,mobile_number,active_status").in("id", ids);
      profs?.forEach((p) => { profMap[p.id] = p as never; });
    }
    setRows(regs.map((r) => ({ ...r, ...profMap[r.user_id] })));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    const remarks = prompt(`Remarks for ${decision}:`) ?? undefined;
    setBusy(true);
    try { await decideAdminRegistration({ data: { registrationId: id, decision, remarks } }); toast.success(`Marked ${decision}`); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const toggle = async (userId: string, active: boolean) => {
    setBusy(true);
    try { await toggleUserActive({ data: { userId, active } }); toast.success(active ? "Enabled" : "Disabled"); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Registration Requests</h1>
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="">All</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Name</th><th className="p-3">Employee ID</th><th className="p-3">Email</th><th className="p-3">District / Mandal / Ward</th><th className="p-3">Department</th><th className="p-3">Status</th><th className="p-3">Submitted</th><th className="p-3">Actions</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No requests.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-3">{r.full_name ?? "—"}</td>
                  <td className="p-3 font-mono">{r.employee_id}</td>
                  <td className="p-3">{r.email ?? "—"}</td>
                  <td className="p-3">{r.district} · {r.mandal} · {r.village_ward}</td>
                  <td className="p-3">{r.department}</td>
                  <td className="p-3"><StatusBadge status={r.verification_status} /></td>
                  <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-3 space-x-2 whitespace-nowrap">
                    {r.verification_status === "pending" && (<>
                      <button disabled={busy} onClick={() => decide(r.id, "approved")} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">Approve</button>
                      <button disabled={busy} onClick={() => decide(r.id, "rejected")} className="rounded bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60">Reject</button>
                    </>)}
                    {r.verification_status === "approved" && (
                      r.active_status
                        ? <button disabled={busy} onClick={() => toggle(r.user_id, false)} className="rounded bg-muted px-3 py-1 text-xs font-semibold hover:bg-muted/80 disabled:opacity-60">Disable</button>
                        : <button disabled={busy} onClick={() => toggle(r.user_id, true)} className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">Enable</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

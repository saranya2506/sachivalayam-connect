import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/AppShell";
import { toast } from "sonner";
import { assignServiceOfficer } from "@/lib/api/services.functions";

export const Route = createFileRoute("/_authenticated/admin/applications")({
  component: AdminApplications,
});

interface Row {
  id: string;
  application_number: string;
  application_type: string;
  status: string;
  citizen_name: string;
  district: string;
  mandal: string;
  village: string;
  assigned_officer_id: string | null;
  department: string | null;
  created_at: string;
}
interface Officer {
  user_id: string;
  department: string;
  full_name: string;
}

function AdminApplications() {
  const [rows, setRows] = useState<Row[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [officerMap, setOfficerMap] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [assignFor, setAssignFor] = useState<Row | null>(null);
  const [pickedOfficer, setPickedOfficer] = useState("");
  const [pickedRemarks, setPickedRemarks] = useState("");

  const load = async () => {
    let query = supabase
      .from("service_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status as never);
    if (type) query = query.eq("application_type", type as never);
    const { data } = await query;
    const rs = (data as Row[]) ?? [];
    setRows(rs);
    const ids = Array.from(
      new Set(rs.map((r) => r.assigned_officer_id).filter(Boolean) as string[]),
    );
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const m: Record<string, string> = {};
      profs?.forEach((p) => {
        m[p.id] = p.full_name;
      });
      setOfficerMap((prev) => ({ ...prev, ...m }));
    }
  };
  const loadOfficers = async () => {
    const { data: o } = await supabase.from("officers").select("user_id,department");
    const ids = (o ?? []).map((x) => x.user_id);
    if (!ids.length) {
      setOfficers([]);
      return;
    }
    const { data: p } = await supabase.from("profiles").select("id,full_name").in("id", ids);
    const map: Record<string, string> = {};
    p?.forEach((x) => {
      map[x.id] = x.full_name;
    });
    setOfficerMap((prev) => ({ ...prev, ...map }));
    setOfficers(
      (o ?? []).map((x) => ({
        user_id: x.user_id,
        department: x.department,
        full_name: map[x.user_id] ?? "",
      })),
    );
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [status, type]);
  useEffect(() => {
    loadOfficers();
  }, []);

  const openAssign = (row: Row) => {
    if (!officers.length) {
      toast.error("No officers available");
      return;
    }
    setPickedOfficer(row.assigned_officer_id ?? officers[0].user_id);
    setPickedRemarks("");
    setAssignFor(row);
  };

  const submitAssign = async () => {
    if (!assignFor || !pickedOfficer) return;
    setBusy(true);
    try {
      await assignServiceOfficer({
        data: {
          applicationId: assignFor.id,
          officerId: pickedOfficer,
          remarks: pickedRemarks || undefined,
        },
      });
      toast.success("Assigned");
      setAssignFor(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const filtered = rows.filter(
    (r) =>
      !q ||
      r.application_number.toLowerCase().includes(q.toLowerCase()) ||
      r.citizen_name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Service Applications</h1>
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap gap-3 border-b p-4">
          <input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            {[
              "submitted",
              "assigned",
              "under_verification",
              "documents_required",
              "approved",
              "rejected",
              "completed",
            ].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All types</option>
            {[
              "income_certificate",
              "pension",
              "ration_card",
              "caste_certificate",
              "residence_certificate",
              "birth_certificate",
              "death_certificate",
            ].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Citizen</th>
                <th className="p-3">Type</th>
                <th className="p-3">Location</th>
                <th className="p-3">Status</th>
                <th className="p-3">Officer</th>
                <th className="p-3">Applied</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    No applications.
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-mono font-semibold">{r.application_number}</td>
                  <td className="p-3">{r.citizen_name}</td>
                  <td className="p-3 capitalize">{r.application_type.replace(/_/g, " ")}</td>
                  <td className="p-3 text-muted-foreground">
                    {r.village}, {r.mandal}, {r.district}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-3">
                    {r.assigned_officer_id ? (
                      <span>
                        {officerMap[r.assigned_officer_id] ?? "—"}
                        {r.department && (
                          <div className="text-xs text-muted-foreground">{r.department}</div>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 space-x-2 whitespace-nowrap">
                    <button
                      disabled={busy}
                      onClick={() => openAssign(r)}
                      className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {r.assigned_officer_id ? "Reassign" : "Assign"}
                    </button>
                    <Link
                      to="/citizen/services/$id"
                      params={{ id: r.id }}
                      className="text-primary hover:underline text-xs"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {assignFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !busy && setAssignFor(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">
              {assignFor.assigned_officer_id ? "Reassign" : "Assign"} Officer
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Application <span className="font-mono">{assignFor.application_number}</span> —{" "}
              {assignFor.citizen_name}
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase text-muted-foreground">
              Officer
            </label>
            <select
              value={pickedOfficer}
              onChange={(e) => setPickedOfficer(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {officers.map((o) => (
                <option key={o.user_id} value={o.user_id}>
                  {o.full_name} — {o.department}
                </option>
              ))}
            </select>
            <label className="mt-4 block text-xs font-semibold uppercase text-muted-foreground">
              Remarks (optional)
            </label>
            <textarea
              value={pickedRemarks}
              onChange={(e) => setPickedRemarks(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={busy}
                onClick={() => setAssignFor(null)}
                className="rounded border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                disabled={busy || !pickedOfficer}
                onClick={submitAssign}
                className="rounded bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Assigning…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

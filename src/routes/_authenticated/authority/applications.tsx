import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/AppShell";
import { toast } from "sonner";
import {
  assignServiceOfficer,
  updateServiceStatus,
  requestMissingDocuments,
} from "@/lib/api/services.functions";

export const Route = createFileRoute("/_authenticated/authority/applications")({
  component: AuthorityApplications,
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
  created_at: string;
  last_remark: string | null;
}
interface Officer {
  user_id: string;
  department: string;
  full_name: string;
}

const TYPES = [
  "income_certificate",
  "pension",
  "ration_card",
  "caste_certificate",
  "residence_certificate",
  "birth_certificate",
  "death_certificate",
];
const STATUSES = [
  "submitted",
  "assigned",
  "under_verification",
  "documents_required",
  "approved",
  "rejected",
  "completed",
];

function AuthorityApplications() {
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
    setRows((data as Row[]) ?? []);
  };
  const loadOfficers = async () => {
    const { data: o } = await supabase
      .from("officers")
      .select("user_id,department")
      .eq("active", true);
    const ids = (o ?? []).map((x) => x.user_id);
    const map: Record<string, string> = {};
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      p?.forEach((x) => {
        map[x.id] = x.full_name;
      });
    }
    setOfficerMap(map);
    setOfficers(
      (o ?? []).map((x) => ({
        user_id: x.user_id,
        department: x.department,
        full_name: map[x.user_id] ?? "(unnamed)",
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
      toast.error("No officers available. Ask an Admin to create officers.");
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
      toast.success("Officer assigned");
      setAssignFor(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign");
    } finally {
      setBusy(false);
    }
  };

  const setStatusFor = async (
    id: string,
    next: "under_verification" | "approved" | "rejected" | "completed",
  ) => {
    const remarks = prompt(`Remarks for "${next.replace(/_/g, " ")}":`) ?? undefined;
    setBusy(true);
    try {
      await updateServiceStatus({ data: { applicationId: id, status: next, remarks } });
      toast.success(`Marked ${next}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const reqDocs = async (id: string) => {
    const docs = prompt("Required documents (comma separated):");
    if (!docs) return;
    const list = docs
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!list.length) return;
    const remarks = prompt("Remarks (optional):") ?? undefined;
    setBusy(true);
    try {
      await requestMissingDocuments({ data: { applicationId: id, docTypes: list, remarks } });
      toast.success("Documents requested");
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
      r.citizen_name.toLowerCase().includes(q.toLowerCase()) ||
      r.district.toLowerCase().includes(q.toLowerCase()) ||
      r.village.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Service Applications</h1>
        <p className="text-sm text-muted-foreground">
          Review, assign officers, and decide on citizen service applications.
        </p>
      </div>
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap gap-3 border-b p-4">
          <input
            placeholder="Search ID, citizen, district…"
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
            {STATUSES.map((s) => (
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
            {TYPES.map((s) => (
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
                <th className="p-3">District / Village</th>
                <th className="p-3">Status</th>
                <th className="p-3">Officer</th>
                <th className="p-3">Applied</th>
                <th className="p-3">Actions</th>
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
                <tr key={r.id} className="border-t align-top">
                  <td className="p-3 font-mono font-semibold">{r.application_number}</td>
                  <td className="p-3">{r.citizen_name}</td>
                  <td className="p-3 capitalize">{r.application_type.replace(/_/g, " ")}</td>
                  <td className="p-3 text-muted-foreground">
                    {r.district}
                    <br />
                    {r.village}, {r.mandal}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {r.assigned_officer_id ? (officerMap[r.assigned_officer_id] ?? "—") : "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 space-x-1 space-y-1 whitespace-nowrap">
                    <Link
                      to="/citizen/services/$id"
                      params={{ id: r.id }}
                      className="inline-block rounded border px-2 py-1 text-xs hover:bg-muted"
                    >
                      View
                    </Link>
                    <button
                      disabled={busy}
                      onClick={() => openAssign(r)}
                      className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      {r.assigned_officer_id ? "Reassign" : "Assign"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => reqDocs(r.id)}
                      className="rounded bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      Request Docs
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setStatusFor(r.id, "approved")}
                      className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setStatusFor(r.id, "rejected")}
                      className="rounded bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
                    >
                      Reject
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setStatusFor(r.id, "completed")}
                      className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      Complete
                    </button>
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

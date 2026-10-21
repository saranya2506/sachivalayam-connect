import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin/complaints")({
  component: AdminComplaints,
});

interface Row {
  id: string;
  complaint_number: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  citizen_id: string;
}

function AdminComplaints() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [citizenNames, setCitizenNames] = useState<Record<string, string>>({});

  const load = async () => {
    let q = supabase
      .from("complaints")
      .select("id,complaint_number,title,category,status,created_at,citizen_id")
      .order("created_at", { ascending: false });
    if (status) q = q.eq("status", status as never);
    if (category) q = q.eq("category", category as never);
    const { data } = await q;
    setRows((data as Row[]) ?? []);
    const ids = Array.from(new Set((data ?? []).map((r) => r.citizen_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const m: Record<string, string> = {};
      profs?.forEach((p) => {
        m[p.id] = p.full_name;
      });
      setCitizenNames(m);
    }
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [status, category]);

  const filtered = rows.filter(
    (r) =>
      search === "" ||
      r.complaint_number.toLowerCase().includes(search.toLowerCase()) ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      citizenNames[r.citizen_id]?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">All Complaints</h1>
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <input
            placeholder="Search ID / title / citizen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-md border bg-background px-3 py-1.5 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="assigned">Assigned</option>
            <option value="under_review">Under review</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All categories</option>
            <option value="water_supply">Water Supply</option>
            <option value="drainage">Drainage</option>
            <option value="roads">Roads</option>
            <option value="street_lights">Street Lights</option>
            <option value="sanitation">Sanitation</option>
            <option value="certificates">Certificates</option>
            <option value="pensions">Pensions</option>
            <option value="others">Others</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Title</th>
                <th className="p-3">Citizen</th>
                <th className="p-3">Category</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No complaints match.
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-mono font-semibold">{r.complaint_number}</td>
                  <td className="p-3">{r.title}</td>
                  <td className="p-3">{citizenNames[r.citizen_id] ?? "—"}</td>
                  <td className="p-3 capitalize">{r.category.replace(/_/g, " ")}</td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <Link
                      to="/complaints/$id"
                      params={{ id: r.id }}
                      className="text-primary font-medium hover:underline"
                    >
                      Manage
                    </Link>
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

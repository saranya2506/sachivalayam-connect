import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/AppShell";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/citizen/")({ component: CitizenDashboard });

interface Complaint {
  id: string; complaint_number: string; title: string; category: string;
  status: string; created_at: string; updated_at: string; department: string | null;
  assigned_officer_id: string | null; last_remark: string | null;
  officer_name?: string;
}

function CitizenDashboard() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("complaints")
        .select("id,complaint_number,title,category,status,created_at,updated_at,department,assigned_officer_id,last_remark")
        .eq("citizen_id", user.id).order("created_at", { ascending: false });
      const rows = (data as Complaint[]) ?? [];
      const offIds = Array.from(new Set(rows.map((r) => r.assigned_officer_id).filter(Boolean) as string[]));
      const nameMap: Record<string, string> = {};
      if (offIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", offIds);
        profs?.forEach((p) => { nameMap[p.id] = p.full_name; });
      }
      setComplaints(rows.map((r) => ({ ...r, officer_name: r.assigned_officer_id ? nameMap[r.assigned_officer_id] : undefined })));
    })();
  }, [user]);

  const filtered = complaints.filter((c) =>
    (filter === "" || c.status === filter) &&
    (search === "" || c.complaint_number.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase()))
  );

  const stats = {
    total: complaints.length,
    pending: complaints.filter((c) => c.status === "submitted").length,
    inProgress: complaints.filter((c) => ["assigned", "under_review", "in_progress"].includes(c.status)).length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
    rejected: complaints.filter((c) => c.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Grievances</h1>
          <p className="text-sm text-muted-foreground">Submit and track your complaints.</p>
        </div>
        <Link to="/citizen/new" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />New Complaint
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {([
          ["Total", stats.total],
          ["Pending", stats.pending],
          ["In progress", stats.inProgress],
          ["Resolved", stats.resolved],
          ["Rejected", stats.rejected],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-5">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-1 text-3xl font-bold">{value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <input placeholder="Search by ID or title…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full max-w-xs rounded-md border bg-background px-3 py-1.5 text-sm" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="assigned">Assigned</option>
            <option value="under_review">Under review</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Complaint ID</th><th className="p-3">Title</th><th className="p-3">Category</th><th className="p-3">Status</th><th className="p-3">Assigned Officer</th><th className="p-3">Last Update</th><th className="p-3">Submitted</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No complaints yet. Submit your first complaint to get started.</td></tr>}
              {filtered.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3 font-mono font-semibold">{c.complaint_number}</td>
                  <td className="p-3">{c.title}</td>
                  <td className="p-3 capitalize">{c.category.replace(/_/g, " ")}</td>
                  <td className="p-3"><StatusBadge status={c.status} /></td>
                  <td className="p-3">{c.officer_name ? <span>{c.officer_name}<div className="text-xs text-muted-foreground">{c.department}</div></span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3 text-muted-foreground">{new Date(c.updated_at).toLocaleDateString()}{c.last_remark && <div className="text-xs">{c.last_remark}</div>}</td>
                  <td className="p-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="p-3"><Link to="/complaints/$id" params={{ id: c.id }} className="text-primary font-medium hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

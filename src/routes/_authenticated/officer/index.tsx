import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/officer/")({ component: OfficerDashboard });

interface Row { id: string; complaint_number: string; title: string; status: string; created_at: string }
interface AppRow { id: string; application_number: string; application_type: string; status: string; citizen_name: string; created_at: string }

function OfficerDashboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("complaints").select("id,complaint_number,title,status,created_at")
      .eq("assigned_officer_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as Row[]) ?? []));
    supabase.from("service_applications").select("id,application_number,application_type,status,citizen_name,created_at")
      .eq("assigned_officer_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setApps((data as AppRow[]) ?? []));
  }, [user]);

  const filtered = rows.filter((r) => filter === "" || r.status === filter);
  const open = rows.filter((r) => !["resolved", "rejected"].includes(r.status)).length;
  const resolved = rows.filter((r) => r.status === "resolved").length;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Officer Dashboard</h1><p className="text-sm text-muted-foreground">Complaints & service applications assigned to you.</p></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-5"><div className="text-sm text-muted-foreground">Complaints</div><div className="mt-1 text-3xl font-bold">{rows.length}</div></div>
        <div className="rounded-lg border bg-card p-5"><div className="text-sm text-muted-foreground">Open</div><div className="mt-1 text-3xl font-bold">{open}</div></div>
        <div className="rounded-lg border bg-card p-5"><div className="text-sm text-muted-foreground">Resolved</div><div className="mt-1 text-3xl font-bold">{resolved}</div></div>
        <div className="rounded-lg border bg-card p-5"><div className="text-sm text-muted-foreground">Service Apps</div><div className="mt-1 text-3xl font-bold">{apps.length}</div></div>
      </div>
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">Assigned complaints</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="">All</option><option value="assigned">Assigned</option><option value="under_review">Under review</option>
            <option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option>
          </select>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">ID</th><th className="p-3">Title</th><th className="p-3">Status</th><th className="p-3">Received</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nothing assigned.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-mono font-semibold">{r.complaint_number}</td>
                <td className="p-3">{r.title}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="p-3"><Link to="/complaints/$id" params={{ id: r.id }} className="text-primary font-medium hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-4"><h2 className="font-semibold">Assigned service applications</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">ID</th><th className="p-3">Citizen</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3">Received</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {apps.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No service applications assigned.</td></tr>}
            {apps.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-3 font-mono font-semibold">{a.application_number}</td>
                <td className="p-3">{a.citizen_name}</td>
                <td className="p-3 capitalize">{a.application_type.replace(/_/g, " ")}</td>
                <td className="p-3"><StatusBadge status={a.status} /></td>
                <td className="p-3 text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
                <td className="p-3"><Link to="/citizen/services/$id" params={{ id: a.id }} className="text-primary font-medium hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

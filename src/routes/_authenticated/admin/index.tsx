import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminDashboard });

interface Stat {
  label: string;
  value: number;
  color: string;
}

function AdminDashboard() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [pendingAdmins, setPendingAdmins] = useState(0);

  useEffect(() => {
    (async () => {
      const { count: total } = await supabase
        .from("complaints")
        .select("*", { count: "exact", head: true });
      const { count: open } = await supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .in("status", ["submitted", "assigned", "under_review", "in_progress"]);
      const { count: submitted } = await supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted");
      const { count: resolved } = await supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolved");
      setStats([
        { label: "Total complaints", value: total ?? 0, color: "text-primary" },
        { label: "Awaiting assignment", value: submitted ?? 0, color: "text-amber-600" },
        { label: "Open", value: open ?? 0, color: "text-indigo-600" },
        { label: "Resolved", value: resolved ?? 0, color: "text-emerald-600" },
      ]);
      const { count: pa } = await supabase
        .from("admin_registrations")
        .select("*", { count: "exact", head: true })
        .eq("verification_status", "pending");
      setPendingAdmins(pa ?? 0);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Sachivalayam operations overview.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-5">
            <div className="text-sm text-muted-foreground">{s.label}</div>
            <div className={`mt-1 text-3xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          to="/admin/complaints"
          className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow"
        >
          <div className="text-lg font-semibold">Manage complaints</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Assign officers, update status, track progress.
          </div>
        </Link>
        <Link
          to="/admin/officers"
          className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow"
        >
          <div className="text-lg font-semibold">Officers</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Add and manage department officers.
          </div>
        </Link>
      </div>
      {pendingAdmins > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          There are {pendingAdmins} admin registration request(s) awaiting Government Authority
          approval.
        </div>
      )}
    </div>
  );
}

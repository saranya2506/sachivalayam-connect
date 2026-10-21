import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/authority/")({
  component: AuthorityDashboard,
});

function AuthorityDashboard() {
  const [stats, setStats] = useState({
    pendingAdmins: 0,
    totalComplaints: 0,
    openComplaints: 0,
    totalUsers: 0,
  });
  useEffect(() => {
    (async () => {
      const [{ count: pa }, { count: tc }, { count: oc }, { count: tu }] = await Promise.all([
        supabase
          .from("admin_registrations")
          .select("*", { count: "exact", head: true })
          .eq("verification_status", "pending"),
        supabase.from("complaints").select("*", { count: "exact", head: true }),
        supabase
          .from("complaints")
          .select("*", { count: "exact", head: true })
          .in("status", ["submitted", "assigned", "under_review", "in_progress"]),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        pendingAdmins: pa ?? 0,
        totalComplaints: tc ?? 0,
        openComplaints: oc ?? 0,
        totalUsers: tu ?? 0,
      });
    })();
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Government Authority</h1>
        <p className="text-sm text-muted-foreground">
          State / District Verification Authority dashboard.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Pending admin requests", stats.pendingAdmins, "/authority/admin-requests"],
          ["Total complaints", stats.totalComplaints, "/authority/complaints"],
          ["Open complaints", stats.openComplaints, "/authority/complaints"],
          ["Total users", stats.totalUsers, "/authority/admin-requests"],
        ].map(([label, value, to]) => (
          <Link
            key={label as string}
            to={to as string}
            className="rounded-lg border bg-card p-5 hover:shadow-md transition-shadow"
          >
            <div className="text-sm text-muted-foreground">{label as string}</div>
            <div className="mt-1 text-3xl font-bold">{value as number}</div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          to="/authority/analytics"
          className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow"
        >
          <div className="text-lg font-semibold">Analytics</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Complaint trends, resolution rates and department performance.
          </div>
        </Link>
        <Link
          to="/authority/audit-logs"
          className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow"
        >
          <div className="text-lg font-semibold">Audit Logs</div>
          <div className="mt-1 text-sm text-muted-foreground">Full record of system activity.</div>
        </Link>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/officer/applications")({
  component: OfficerApplications,
});

interface Row {
  id: string;
  application_number: string;
  application_type: string;
  status: string;
  citizen_name: string;
  created_at: string;
}

function OfficerApplications() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase
      .from("service_applications")
      .select("id,application_number,application_type,status,citizen_name,created_at")
      .eq("assigned_officer_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [user]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Assigned Applications</h1>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Citizen</th>
              <th className="p-3">Type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Applied</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No applications assigned.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-mono font-semibold">{r.application_number}</td>
                <td className="p-3">{r.citizen_name}</td>
                <td className="p-3 capitalize">{r.application_type.replace(/_/g, " ")}</td>
                <td className="p-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="p-3 text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <Link
                    to="/citizen/services/$id"
                    params={{ id: r.id }}
                    className="text-primary font-medium hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

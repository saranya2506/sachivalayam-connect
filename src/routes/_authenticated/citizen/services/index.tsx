import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/AppShell";
import { FileCheck } from "lucide-react";
import { SERVICE_TYPES } from "@/lib/api/services.functions";

export const Route = createFileRoute("/_authenticated/citizen/services/")({
  component: ServicesIndex,
});

const LABELS: Record<string, string> = {
  income_certificate: "Income Certificate",
  pension: "Pension Application",
  ration_card: "Ration Card",
  caste_certificate: "Caste Certificate",
  residence_certificate: "Residence Certificate",
  birth_certificate: "Birth Certificate",
  death_certificate: "Death Certificate",
};

interface AppRow {
  id: string;
  application_number: string;
  application_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_remark: string | null;
}

function ServicesIndex() {
  const { user } = useAuth();
  const [apps, setApps] = useState<AppRow[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("service_applications")
      .select("id,application_number,application_type,status,created_at,updated_at,last_remark")
      .eq("citizen_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setApps((data as AppRow[]) ?? []));
  }, [user]);

  const stats = {
    total: apps.length,
    pending: apps.filter((a) => a.status === "submitted").length,
    underVerification: apps.filter((a) => ["assigned", "under_verification"].includes(a.status))
      .length,
    docsRequired: apps.filter((a) => a.status === "documents_required").length,
    approved: apps.filter((a) => a.status === "approved").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
    completed: apps.filter((a) => a.status === "completed").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Government Services</h1>
        <p className="text-sm text-muted-foreground">
          Apply for certificates and track your applications.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
        {(
          [
            ["Total", stats.total],
            ["Pending", stats.pending],
            ["Under verification", stats.underVerification],
            ["Documents required", stats.docsRequired],
            ["Approved", stats.approved],
            ["Rejected", stats.rejected],
            ["Completed", stats.completed],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Apply for a Service</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_TYPES.map((t) => (
            <Link
              key={t}
              to="/citizen/services/new/$type"
              params={{ type: t }}
              className="group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary"
            >
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <FileCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{LABELS[t]}</div>
                <div className="text-xs text-muted-foreground">Apply now</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b p-4 font-semibold">My Applications</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Application ID</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Applied</th>
                <th className="p-3">Last update</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {apps.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No applications yet.
                  </td>
                </tr>
              )}
              {apps.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-3 font-mono font-semibold">{a.application_number}</td>
                  <td className="p-3">{LABELS[a.application_type] ?? a.application_type}</td>
                  <td className="p-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(a.updated_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <Link
                      to="/citizen/services/$id"
                      params={{ id: a.id }}
                      className="text-primary font-medium hover:underline"
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
    </div>
  );
}

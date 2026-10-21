import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/authority/analytics")({
  component: Analytics,
});

const COLORS = [
  "#1e3a8a",
  "#d97706",
  "#059669",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#65a30d",
  "#9333ea",
];

function Analytics() {
  const [byCategory, setByCategory] = useState<{ name: string; value: number }[]>([]);
  const [byStatus, setByStatus] = useState<{ name: string; value: number }[]>([]);
  const [byDept, setByDept] = useState<{ name: string; value: number }[]>([]);
  const [trend, setTrend] = useState<{ month: string; complaints: number; resolved: number }[]>([]);
  const [appsByType, setAppsByType] = useState<{ name: string; value: number }[]>([]);
  const [appsByStatus, setAppsByStatus] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("complaints")
        .select("category,status,department,created_at");
      const all = data ?? [];
      const agg = (key: "category" | "status" | "department") => {
        const m: Record<string, number> = {};
        all.forEach((r) => {
          const k = (r as Record<string, unknown>)[key] as string | null;
          const v = k ?? "—";
          m[v] = (m[v] ?? 0) + 1;
        });
        return Object.entries(m).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
      };
      setByCategory(agg("category"));
      setByStatus(agg("status"));
      setByDept(agg("department"));

      const months: Record<string, { complaints: number; resolved: number }> = {};
      all.forEach((r) => {
        const d = new Date(r.created_at as string);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months[k] ||= { complaints: 0, resolved: 0 };
        months[k].complaints++;
        if (r.status === "resolved") months[k].resolved++;
      });
      setTrend(
        Object.entries(months)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, v]) => ({ month, ...v })),
      );

      const { data: apps } = await supabase
        .from("service_applications")
        .select("application_type,status");
      const allApps = apps ?? [];
      const aggApps = (key: "application_type" | "status") => {
        const m: Record<string, number> = {};
        allApps.forEach((r) => {
          const k = (r as Record<string, unknown>)[key] as string;
          m[k] = (m[k] ?? 0) + 1;
        });
        return Object.entries(m).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
      };
      setAppsByType(aggApps("application_type"));
      setAppsByStatus(aggApps("status"));
    })();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Complaints by category">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#1e3a8a" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Complaints by status">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={100} label>
                {byStatus.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Monthly trends">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="complaints" stroke="#1e3a8a" />
              <Line type="monotone" dataKey="resolved" stroke="#059669" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Department-wise complaints">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byDept} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#d97706" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Service applications by type">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={appsByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Service applications by status">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={appsByStatus} dataKey="value" nameKey="name" outerRadius={100} label>
                {appsByStatus.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </div>
  );
}

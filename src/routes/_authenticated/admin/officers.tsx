import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createOfficer } from "@/lib/api/sachivalayam.functions";

export const Route = createFileRoute("/_authenticated/admin/officers")({
  component: AdminOfficers,
});

interface OfficerRow {
  user_id: string;
  department: string;
  active: boolean;
  created_at: string;
  profiles: { full_name: string; email: string; mobile_number: string | null } | null;
}

function AdminOfficers() {
  const [rows, setRows] = useState<OfficerRow[]>([]);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    department: "",
    mobileNumber: "",
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("officers")
      .select("user_id,department,active,created_at,profiles!inner(full_name,email,mobile_number)")
      .order("created_at", { ascending: false });
    setRows((data as unknown as OfficerRow[]) ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createOfficer({ data: form });
      toast.success("Officer created");
      setForm({ fullName: "", email: "", password: "", department: "", mobileNumber: "" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-3">
        <h1 className="text-2xl font-bold">Officers</h1>
        <div className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Department</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No officers yet.
                  </td>
                </tr>
              )}
              {rows.map((o) => (
                <tr key={o.user_id} className="border-t">
                  <td className="p-3">{o.profiles?.full_name}</td>
                  <td className="p-3">{o.profiles?.email}</td>
                  <td className="p-3">{o.department}</td>
                  <td className="p-3">{o.active ? "Active" : "Disabled"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <form onSubmit={submit} className="rounded-lg border bg-card p-6 space-y-3 h-fit">
        <h2 className="font-semibold">Add officer</h2>
        <input
          required
          placeholder="Full name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          placeholder="Mobile (optional)"
          value={form.mobileNumber}
          onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="Department"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          required
          type="password"
          placeholder="Temp password (min 8)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button
          disabled={busy}
          className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create officer"}
        </button>
      </form>
    </div>
  );
}

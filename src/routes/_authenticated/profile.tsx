import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({ component: Profile });

interface ProfileRow {
  full_name: string;
  email: string;
  mobile_number: string | null;
  address: string | null;
  village: string | null;
  department: string | null;
}

function Profile() {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [adminReg, setAdminReg] = useState<{
    employee_id: string;
    district: string;
    mandal: string;
    village_ward: string;
    department: string;
  } | null>(null);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name,email,mobile_number,address,village,department")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as ProfileRow));
    if (role === "admin") {
      supabase
        .from("admin_registrations")
        .select("employee_id,district,mandal,village_ward,department")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => setAdminReg(data));
    }
  }, [user, role]);

  if (!user || !profile) return <div className="text-muted-foreground">Loading…</div>;

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        mobile_number: profile.mobile_number,
        address: profile.address,
        village: profile.village,
        department: profile.department,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.next.length < 8) return toast.error("New password must be at least 8 characters");
    if (pwd.next !== pwd.confirm) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      // verify current
      const { error: verErr } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: pwd.current,
      });
      if (verErr) throw new Error("Current password is incorrect");
      const { error } = await supabase.auth.updateUser({ password: pwd.next });
      if (error) throw error;
      await supabase
        .from("audit_logs")
        .insert({ actor_id: user.id, actor_email: user.email, action: "PASSWORD_CHANGED" });
      toast.success("Password changed");
      setPwd({ current: "", next: "", confirm: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const Field = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string | null;
    onChange: (v: string) => void;
  }) => (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
      </div>
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">Personal details</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field
            label="Full Name"
            value={profile.full_name}
            onChange={(v) => setProfile({ ...profile, full_name: v })}
          />
          <Field
            label="Mobile Number"
            value={profile.mobile_number}
            onChange={(v) => setProfile({ ...profile, mobile_number: v })}
          />
          {role === "citizen" && (
            <>
              <Field
                label="Village"
                value={profile.village}
                onChange={(v) => setProfile({ ...profile, village: v })}
              />
              <Field
                label="Address"
                value={profile.address}
                onChange={(v) => setProfile({ ...profile, address: v })}
              />
            </>
          )}
          {(role === "officer" || role === "admin") && (
            <Field
              label="Department"
              value={profile.department}
              onChange={(v) => setProfile({ ...profile, department: v })}
            />
          )}
          {role === "admin" && adminReg && (
            <>
              <div>
                <label className="block text-sm font-medium">Employee ID</label>
                <div className="mt-1 rounded-md border bg-muted px-3 py-2 text-sm">
                  {adminReg.employee_id}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">District</label>
                <div className="mt-1 rounded-md border bg-muted px-3 py-2 text-sm">
                  {adminReg.district}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Mandal</label>
                <div className="mt-1 rounded-md border bg-muted px-3 py-2 text-sm">
                  {adminReg.mandal}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Village / Ward</label>
                <div className="mt-1 rounded-md border bg-muted px-3 py-2 text-sm">
                  {adminReg.village_ward}
                </div>
              </div>
            </>
          )}
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          Save
        </button>
      </section>
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">Change password</h2>
        <form onSubmit={changePassword} className="space-y-3 max-w-md">
          <input
            required
            type="password"
            placeholder="Current password"
            value={pwd.current}
            onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            required
            type="password"
            placeholder="New password (min 8)"
            value={pwd.next}
            onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            required
            type="password"
            placeholder="Confirm new password"
            value={pwd.confirm}
            onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <button
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            Change password
          </button>
        </form>
      </section>
    </div>
  );
}

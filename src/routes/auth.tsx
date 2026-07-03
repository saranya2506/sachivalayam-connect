import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleHome } from "@/lib/auth";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { isDevMode } from "@/lib/dev-mode";
import { seedDemoAccounts } from "@/lib/api/sachivalayam.functions";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const nav = useNavigate();
  const { user, role, loading, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!loading && user && role) nav({ to: roleHome(role) });
  }, [loading, user, role, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // check active_status
      const { data: prof } = await supabase.from("profiles").select("active_status").eq("id", data.user.id).maybeSingle();
      if (prof && prof.active_status === false) {
        await supabase.auth.signOut();
        throw new Error("Your account is not active. Please contact the authority.");
      }
      // check admin verification (block if not yet approved or no request exists)
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      const isAdmin = roles?.some((r) => r.role === "admin");
      if (isAdmin) {
        const { data: reg } = await supabase.from("admin_registrations").select("verification_status").eq("user_id", data.user.id).maybeSingle();
        if (!reg || reg.verification_status !== "approved") {
          await supabase.auth.signOut();
          throw new Error(reg
            ? `Admin registration is ${reg.verification_status}. You cannot login yet.`
            : "Admin access has not been approved by the Government Authority.");
        }
      }
      await supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", data.user.id);
      // audit
      await supabase.from("audit_logs").insert({ actor_id: data.user.id, actor_email: data.user.email, action: "LOGIN" });
      // Refresh auth context so role is loaded before the useEffect redirect fires
      await refresh();
      toast.success("Signed in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const seedDemo = async () => {
    setSeeding(true);
    try {
      await seedDemoAccounts();
      toast.success("Demo accounts seeded. You can sign in now.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded bg-primary text-primary-foreground text-xl font-bold">ఎస్</div>
          <h1 className="text-2xl font-bold text-foreground">Digital Sachivalayam</h1>
          <p className="mt-1 text-sm text-muted-foreground">Citizen Grievance & Service Management</p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Sign in to your account</h2>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium">Password</label>
              <div className="relative mt-1">
                <input required type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
              <Link to="/forgot-password" className="font-medium text-primary hover:underline">Forgot password?</Link>
            </div>
            <button disabled={busy} className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="mt-5 flex flex-col gap-1 text-sm text-center">
            <Link to="/register-citizen" className="text-primary hover:underline">Register as Citizen</Link>
            <Link to="/register-admin" className="text-primary hover:underline">Register as Admin (Sachivalayam staff)</Link>
          </div>
        </div>
        {isDevMode() && (
          <div className="mt-6 rounded-md border border-dashed border-accent bg-accent/10 p-4 text-xs">
            <div className="mb-2 font-bold text-foreground">Development mode</div>
            <p className="text-muted-foreground">
              Only the Government Authority account is seeded. Admins self-register and await approval,
              Officers are created by an approved Admin, and Citizens self-register.
            </p>
            <div className="mt-2 text-muted-foreground">
              Authority: <span className="font-mono">authority@sachivalayam.gov</span> / <span className="font-mono">Authority@123</span>
            </div>
            <button onClick={seedDemo} disabled={seeding} className="mt-3 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-60">
              {seeding ? "Seeding…" : "Seed Government Authority"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

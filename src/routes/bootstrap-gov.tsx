import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { bootstrapGovAuthority, getBootstrapStatus } from "@/lib/api/sachivalayam.functions";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/bootstrap-gov")({ component: Bootstrap });

function Bootstrap() {
  const nav = useNavigate();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => getBootstrapStatus(),
  });
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  const alreadyConfigured = !isLoading && data && data.govAuthorityCount > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    try {
      await bootstrapGovAuthority({ data: form });
      toast.success("Government Authority created. Please sign in.");
      nav({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bootstrap failed");
      refetch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-bold">Government Authority — First-time setup</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          This is the State / District Verification Authority account. It can only be created once.
        </p>
        {isLoading && <p className="text-sm text-muted-foreground">Checking…</p>}
        {alreadyConfigured && (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Government Authority already configured.
            </div>
            <Link
              to="/auth"
              className="block w-full rounded-md bg-primary py-2 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Go to login
            </Link>
          </div>
        )}
        {!alreadyConfigured && !isLoading && (
          <form onSubmit={submit} className="space-y-3">
            <input
              required
              placeholder="Full name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              required
              type="password"
              placeholder="Password (min 8)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              disabled={busy}
              className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create Government Authority"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPassword });

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Reset email sent. Check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-bold">Reset password</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          We'll send a reset link to your registered email.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            disabled={busy}
            className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <p className="mt-4 text-sm text-center">
          <Link to="/auth" className="text-primary hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, roleHome } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: ProtectedLayout,
});

// Map each role to the URL prefix it owns
const ROLE_PREFIX: Record<string, string> = {
  government_authority: "/authority",
  admin: "/admin",
  officer: "/officer",
  citizen: "/citizen",
};

function ProtectedLayout() {
  const nav = useNavigate();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      nav({ to: "/auth" });
      return;
    }
    // If logged in and role is known, make sure the current path matches the role
    if (!loading && user && role) {
      const correctPrefix = ROLE_PREFIX[role];
      const currentPath = window.location.pathname;
      // If user is on a path that doesn't belong to their role, redirect to their home
      const isOnWrongPrefix = Object.values(ROLE_PREFIX).some(
        (prefix) => prefix !== correctPrefix && currentPath.startsWith(prefix)
      );
      if (isOnWrongPrefix || currentPath === "/") {
        nav({ to: roleHome(role) });
      }
    }
  }, [loading, user, role, nav]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>
  );
  if (!user) return null;

  if (!role) return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="font-bold text-xl">Account pending</h2>
        <p className="text-muted-foreground mt-2">
          Your account doesn't have an assigned role yet. Please contact the authority.
        </p>
        <button
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    </div>
  );

  return <AppShell><Outlet /></AppShell>;
}

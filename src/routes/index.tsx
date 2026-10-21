import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth, roleHome } from "@/lib/auth";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, role, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  if (user && role) return <Navigate to={roleHome(role)} />;
  return <Navigate to="/auth" />;
}

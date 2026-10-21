import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/access-denied")({ component: AccessDenied });

function AccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold text-destructive">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">
          Unauthorized — you don't have permission to view this page.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

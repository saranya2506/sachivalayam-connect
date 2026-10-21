import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/citizen/services")({
  component: ServicesLayout,
});

function ServicesLayout() {
  return <Outlet />;
}

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rh/employes")({
  beforeLoad: () => {
    throw redirect({ to: "/app/employees" });
  },
});

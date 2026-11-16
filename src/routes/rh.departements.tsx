import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rh/departements")({
  beforeLoad: () => {
    throw redirect({ to: "/app/departments" });
  },
});

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/employes/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/app/employees/$id", params: { id: params.id } });
  },
});

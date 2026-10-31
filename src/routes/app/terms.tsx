import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/terms")({
  component: () => <Navigate to="/app/entities" />,
});

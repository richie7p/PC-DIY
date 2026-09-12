import { createFileRoute } from "@tanstack/react-router";
import { BuilderApp } from "@/components/builder/builder-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <BuilderApp />;
}

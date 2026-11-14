import { createFileRoute } from "@tanstack/react-router";
import { Roadmap } from "@/components/interviv/learning";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/roadmap")({
  head: () =>
    pageHead("Roadmap", "InterViv roadmap: focused preparation and your next small step."),
  component: () => (
    <AppShell>
      <Roadmap />
    </AppShell>
  ),
});

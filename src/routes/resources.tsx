import { createFileRoute } from "@tanstack/react-router";
import { Resources } from "@/components/interviv/learning";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/resources")({
  head: () =>
    pageHead(
      "Learning library",
      "InterViv resources: focused preparation and your next small step.",
    ),
  component: () => (
    <AppShell>
      <Resources />
    </AppShell>
  ),
});

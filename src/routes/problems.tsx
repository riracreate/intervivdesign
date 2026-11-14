import { createFileRoute } from "@tanstack/react-router";
import { Problems } from "@/components/interviv/learning";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/problems")({
  head: () =>
    pageHead("Coding arena", "InterViv problems: focused preparation and your next small step."),
  component: () => (
    <AppShell>
      <Problems />
    </AppShell>
  ),
});

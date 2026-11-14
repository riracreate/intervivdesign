import { createFileRoute } from "@tanstack/react-router";
import { Jobs } from "@/components/interviv/learning";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/jobs")({
  head: () =>
    pageHead("Jobs explorer", "InterViv jobs: focused preparation and your next small step."),
  component: () => (
    <AppShell>
      <Jobs />
    </AppShell>
  ),
});

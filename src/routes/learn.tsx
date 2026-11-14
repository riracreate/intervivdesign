import { createFileRoute } from "@tanstack/react-router";
import { Learn } from "@/components/interviv/learning";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/learn")({
  head: () =>
    pageHead("Learning hub", "InterViv learn: focused preparation and your next small step."),
  component: () => (
    <AppShell>
      <Learn />
    </AppShell>
  ),
});

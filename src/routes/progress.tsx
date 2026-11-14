import { createFileRoute } from "@tanstack/react-router";
import { Progress } from "@/components/interviv/learning";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/progress")({
  head: () =>
    pageHead("Progress", "InterViv progress: focused preparation and your next small step."),
  component: () => (
    <AppShell>
      <Progress />
    </AppShell>
  ),
});

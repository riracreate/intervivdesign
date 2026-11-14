import { createFileRoute } from "@tanstack/react-router";
import { Resume } from "@/components/interviv/resume";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/resume")({
  head: () =>
    pageHead("Resume check", "InterViv resume: focused preparation and your next small step."),
  component: () => (
    <AppShell>
      <Resume />
    </AppShell>
  ),
});

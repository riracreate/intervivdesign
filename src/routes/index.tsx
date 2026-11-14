import { createFileRoute } from "@tanstack/react-router";
import { Overview } from "@/components/interviv/overview";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/")({
  head: () => pageHead("Overview", "InterViv index: focused preparation and your next small step."),
  component: () => (
    <AppShell>
      <Overview />
    </AppShell>
  ),
});

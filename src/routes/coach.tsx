import { createFileRoute } from "@tanstack/react-router";
import { Coach } from "@/components/interviv/coach";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/coach")({
  head: () => pageHead("AI coach", "InterViv coach: focused preparation and your next small step."),
  component: () => (
    <AppShell>
      <Coach />
    </AppShell>
  ),
});

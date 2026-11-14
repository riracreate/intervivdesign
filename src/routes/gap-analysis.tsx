import { createFileRoute } from "@tanstack/react-router";
import { GapAnalysis } from "@/components/interviv/learning";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/gap-analysis")({
  head: () =>
    pageHead(
      "Role gap analysis",
      "InterViv gap analysis: focused preparation and your next small step.",
    ),
  component: () => (
    <AppShell>
      <GapAnalysis />
    </AppShell>
  ),
});

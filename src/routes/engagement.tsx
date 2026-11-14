import { createFileRoute } from "@tanstack/react-router";
import { EngagementAnalyzer } from "@/components/interviv/engagement-analyzer";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";

export const Route = createFileRoute("/engagement")({
  head: () =>
    pageHead("Engagement analyzer", "Local-only camera feedback for eye contact and posture."),
  component: () => (
    <AppShell>
      <EngagementAnalyzer />
    </AppShell>
  ),
});

import { createFileRoute } from "@tanstack/react-router";
import { ReportCard } from "@/components/interviv/report-card";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";

export const Route = createFileRoute("/report-card")({
  validateSearch: (s: Record<string, unknown>): { d?: string | undefined } => ({
    d: typeof s["d"] === "string" ? s["d"] : undefined,
  }),
  head: () => pageHead("Report card", "A shareable InterViv practice report card."),
  component: Page,
});

function Page() {
  const { d } = Route.useSearch();
  return (
    <AppShell>
      <ReportCard code={d} />
    </AppShell>
  );
}

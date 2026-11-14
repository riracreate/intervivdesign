import { createFileRoute } from "@tanstack/react-router";
import { Report } from "@/components/interviv/report";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/dashboard/$sessionId")({
  head: () => pageHead("Report", "Your private InterViv practice session and feedback."),
  component: Page,
});
function Page() {
  const { sessionId } = Route.useParams();
  return (
    <AppShell>
      <Report id={sessionId} />
    </AppShell>
  );
}

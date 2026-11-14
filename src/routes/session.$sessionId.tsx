import { createFileRoute } from "@tanstack/react-router";
import { Session } from "@/components/interviv/session";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/session/$sessionId")({
  head: () => pageHead("Session", "Your private InterViv practice session and feedback."),
  component: Page,
});
function Page() {
  const { sessionId } = Route.useParams();
  return (
    <AppShell>
      <Session id={sessionId} />
    </AppShell>
  );
}

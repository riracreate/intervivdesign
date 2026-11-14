import { createFileRoute } from "@tanstack/react-router";
import { VoicePlayback } from "@/components/interviv/voice-playback";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";

export const Route = createFileRoute("/voice-playback/$sessionId")({
  head: () => pageHead("Voice playback", "Replay your voice interview transcript with scores."),
  component: Page,
});

function Page() {
  const { sessionId } = Route.useParams();
  return (
    <AppShell>
      <VoicePlayback sessionId={sessionId} />
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { VoiceInterview } from "@/components/interviv/voice-interview";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";

export const Route = createFileRoute("/voice")({
  head: () =>
    pageHead(
      "Voice interview",
      "Speak your answers with live transcription and adaptive follow-ups.",
    ),
  component: () => (
    <AppShell>
      <VoiceInterview />
    </AppShell>
  ),
});

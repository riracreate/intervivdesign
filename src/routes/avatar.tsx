import { createFileRoute } from "@tanstack/react-router";
import { AvatarInterview } from "@/components/interviv/avatar-interview";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";

export const Route = createFileRoute("/avatar")({
  head: () =>
    pageHead("Interview with Viv", "A spoken interview with a lip-synced 3D avatar interviewer."),
  component: () => (
    <AppShell>
      <AvatarInterview />
    </AppShell>
  ),
});

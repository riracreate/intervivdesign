import { createFileRoute } from "@tanstack/react-router";
import { Resume } from "@/components/interviv/resume";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/upload")({
  head: () =>
    pageHead(
      "Your skills",
      "Start your InterViv skill onboarding with a resume or your interests.",
    ),
  component: () => (
    <AppShell>
      <Resume onboarding />
    </AppShell>
  ),
});

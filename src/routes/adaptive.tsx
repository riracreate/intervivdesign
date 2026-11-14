import { createFileRoute } from "@tanstack/react-router";
import { AdaptiveHub } from "@/components/interviv/adaptive-hub";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";

export const Route = createFileRoute("/adaptive")({
  head: () =>
    pageHead(
      "Adaptive learning",
      "SM-2 spaced repetition, adaptive difficulty, and role-specific question sets.",
    ),
  component: () => (
    <AppShell>
      <AdaptiveHub />
    </AppShell>
  ),
});

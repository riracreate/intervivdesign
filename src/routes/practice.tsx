import { createFileRoute } from "@tanstack/react-router";
import { Practice } from "@/components/interviv/practice";
import { AppShell } from "@/components/interviv/ui";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/practice")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { mode?: string | undefined; skill?: string | undefined } => ({
    mode: typeof s["mode"] === "string" ? s["mode"] : undefined,
    skill: typeof s["skill"] === "string" ? s["skill"] : undefined,
  }),
  head: () =>
    pageHead(
      "Practice",
      "Choose your InterViv interview, coding, SQL or behavioral practice session.",
    ),
  component: Page,
});
function Page() {
  const { mode, skill } = Route.useSearch();
  return (
    <AppShell>
      <Practice initialMode={mode} initialSkill={skill} />
    </AppShell>
  );
}

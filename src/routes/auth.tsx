import { createFileRoute } from "@tanstack/react-router";
import { Auth } from "@/components/interviv/auth";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/auth")({
  head: () =>
    pageHead("Auth", "Your InterViv account: save practice and build interview confidence."),
  component: () => <Auth initialSignup={false} reset={false} />,
});

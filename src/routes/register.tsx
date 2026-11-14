import { createFileRoute } from "@tanstack/react-router";
import { Auth } from "@/components/interviv/auth";
import { pageHead } from "@/lib/interviv/meta";
export const Route = createFileRoute("/register")({
  head: () =>
    pageHead("Register", "Your InterViv account: save practice and build interview confidence."),
  component: () => <Auth initialSignup={true} reset={false} />,
});

export type LinkedInOAuthProfile = {
  fullName: string;
  email: string;
  headline: string;
  location: string;
  picture?: string | undefined;
};

export const LINKEDIN_CALLBACK_PATH = "/auth/linkedin/callback";

export function resolveAppBaseUrl(envAppUrl: string | undefined, requestUrl: string): string {
  const cleaned = envAppUrl?.trim().replace(/\/+$/, "");
  if (cleaned) return cleaned;
  try {
    return new URL(requestUrl).origin.replace(/\/+$/, "");
  } catch {
    return "http://localhost:3000";
  }
}

export function buildLinkedInRedirectUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${LINKEDIN_CALLBACK_PATH}`;
}

export function buildLinkedInAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string | undefined;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    scope: opts.scope?.trim() || "openid profile email",
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export function isAllowedOAuthOrigin(origin: string): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return (
      parsed.hostname.endsWith(".run.app") ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

export function renderLinkedInPopupHtml(
  payload:
    | { type: "LINKEDIN_OAUTH_SUCCESS"; profile: LinkedInOAuthProfile }
    | { type: "LINKEDIN_OAUTH_ERROR"; message: string },
): string {
  const serialized = JSON.stringify(payload).replace(/</g, "\\u003c");
  const title =
    payload.type === "LINKEDIN_OAUTH_SUCCESS"
      ? "LinkedIn Connected · InterViv"
      : "LinkedIn Connection Issue · InterViv";
  const bodyMsg =
    payload.type === "LINKEDIN_OAUTH_SUCCESS"
      ? "LinkedIn profile connected. Returning to your InterViv dashboard…"
      : payload.message;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;background:#0f172a;color:#f8fafc;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}
      .card{max-width:420px;padding:24px;border-radius:16px;background:#1e293b;border:1px solid rgba(148,163,184,.25)}
      p{color:#94a3b8;line-height:1.5}
    </style>
  </head>
  <body>
    <div class="card">
      <h2>${payload.type === "LINKEDIN_OAUTH_SUCCESS" ? "Connected to LinkedIn" : "Could not connect LinkedIn"}</h2>
      <p>${bodyMsg.replace(/[<>&"]/g, "")}</p>
    </div>
    <script>
      (function () {
        var msg = ${serialized};
        if (window.opener) {
          window.opener.postMessage(msg, "*");
          setTimeout(function () { window.close(); }, 250);
        } else {
          window.location.href = "/";
        }
      })();
    </script>
  </body>
</html>`;
}

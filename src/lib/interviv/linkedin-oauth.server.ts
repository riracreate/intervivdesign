import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  buildLinkedInAuthUrl,
  buildLinkedInRedirectUri,
  LINKEDIN_CALLBACK_PATH,
  renderLinkedInPopupHtml,
  resolveAppBaseUrl,
  type LinkedInOAuthProfile,
} from "./linkedin-oauth";

const STATE_COOKIE = "interviv_li_state";

function signState(nonce: string, secret: string): string {
  const payload = `${nonce}.${Date.now()}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifySignedState(state: string, secret: string): boolean {
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [nonce, tsStr, sig] = parts;
  if (!nonce || !tsStr || !sig) return false;
  const ts = Number(tsStr);
  if (!Number.isFinite(ts) || Date.now() - ts > 15 * 60 * 1000) return false;
  const expected = createHmac("sha256", secret).update(`${nonce}.${tsStr}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

export async function handleLinkedInRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/linkedin/url" && request.method === "GET") {
    const clientId = process.env["LINKEDIN_CLIENT_ID"]?.trim() ?? "";
    const clientSecret = process.env["LINKEDIN_CLIENT_SECRET"]?.trim() ?? "";
    const baseUrl = resolveAppBaseUrl(process.env["APP_URL"], request.url);
    const redirectUri = buildLinkedInRedirectUri(baseUrl);

    if (!clientId || !clientSecret) {
      return Response.json({
        configured: false,
        redirectUri,
        message:
          "LinkedIn OAuth credentials (LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET) are not configured on the server yet.",
      });
    }

    const nonce = randomBytes(16).toString("hex");
    const state = signState(nonce, clientSecret);
    const authUrl = buildLinkedInAuthUrl({
      clientId,
      redirectUri,
      state,
      scope: process.env["LINKEDIN_SCOPES"],
    });

    const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
    headers.set(
      "Set-Cookie",
      `${STATE_COOKIE}=${encodeURIComponent(state)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=600`,
    );
    return new Response(JSON.stringify({ configured: true, url: authUrl, redirectUri }), {
      status: 200,
      headers,
    });
  }

  if (path === LINKEDIN_CALLBACK_PATH || path === `${LINKEDIN_CALLBACK_PATH}/`) {
    const htmlHeaders = { "content-type": "text/html; charset=utf-8" };
    const errorParam = url.searchParams.get("error");
    const errorDesc = url.searchParams.get("error_description");
    if (errorParam) {
      return new Response(
        renderLinkedInPopupHtml({
          type: "LINKEDIN_OAUTH_ERROR",
          message: errorDesc || `LinkedIn authorization cancelled (${errorParam}).`,
        }),
        { status: 200, headers: htmlHeaders },
      );
    }

    const code = url.searchParams.get("code")?.trim() ?? "";
    const state = url.searchParams.get("state")?.trim() ?? "";
    const clientId = process.env["LINKEDIN_CLIENT_ID"]?.trim() ?? "";
    const clientSecret = process.env["LINKEDIN_CLIENT_SECRET"]?.trim() ?? "";
    const baseUrl = resolveAppBaseUrl(process.env["APP_URL"], request.url);
    const redirectUri = buildLinkedInRedirectUri(baseUrl);

    if (!code || !state || !clientId || !clientSecret || !verifySignedState(state, clientSecret)) {
      return new Response(
        renderLinkedInPopupHtml({
          type: "LINKEDIN_OAUTH_ERROR",
          message: "Missing or invalid LinkedIn OAuth verification state.",
        }),
        { status: 400, headers: htmlHeaders },
      );
    }

    try {
      const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!tokenRes.ok) {
        return new Response(
          renderLinkedInPopupHtml({
            type: "LINKEDIN_OAUTH_ERROR",
            message: `LinkedIn token exchange failed (${tokenRes.status}).`,
          }),
          { status: 400, headers: htmlHeaders },
        );
      }

      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        return new Response(
          renderLinkedInPopupHtml({
            type: "LINKEDIN_OAUTH_ERROR",
            message: "LinkedIn did not return an access token.",
          }),
          { status: 400, headers: htmlHeaders },
        );
      }

      const userInfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { authorization: `Bearer ${tokenJson.access_token}` },
      });

      if (!userInfoRes.ok) {
        return new Response(
          renderLinkedInPopupHtml({
            type: "LINKEDIN_OAUTH_ERROR",
            message: `Could not fetch LinkedIn profile (${userInfoRes.status}).`,
          }),
          { status: 400, headers: htmlHeaders },
        );
      }

      const info = (await userInfoRes.json()) as {
        name?: string;
        given_name?: string;
        family_name?: string;
        email?: string;
        picture?: string;
        locale?: { country?: string };
      };

      const fullName =
        info.name?.trim() ||
        [info.given_name, info.family_name].filter(Boolean).join(" ").trim() ||
        "LinkedIn Member";

      const profile: LinkedInOAuthProfile = {
        fullName,
        email: info.email ?? "",
        headline: "",
        location: info.locale?.country ?? "",
        picture: info.picture,
      };

      return new Response(
        renderLinkedInPopupHtml({
          type: "LINKEDIN_OAUTH_SUCCESS",
          profile,
        }),
        { status: 200, headers: htmlHeaders },
      );
    } catch {
      return new Response(
        renderLinkedInPopupHtml({
          type: "LINKEDIN_OAUTH_ERROR",
          message: "Network error communicating with LinkedIn OAuth.",
        }),
        { status: 500, headers: htmlHeaders },
      );
    }
  }

  return null;
}

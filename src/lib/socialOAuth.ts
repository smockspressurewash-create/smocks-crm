// ─── Direct platform OAuth (fallback to Buffer) ─────────────────────────────
// Buffer is the primary, recommended way to connect social accounts (it
// handles all platforms through one API key). These helpers let a user
// connect Instagram/Facebook (Meta), LinkedIn, or TikTok directly instead,
// for platforms or accounts where Buffer isn't an option.
//
// The OAuth *authorization* step (redirecting to the platform and getting a
// `code` back) is safe to do entirely from the browser. The *token exchange*
// step needs the app's client secret, which can never live in frontend code
// — so, exactly like the existing Google OAuth flow in this app, the actual
// code-for-token exchange is proxied through an optional self-hosted backend
// (`settings.socialBackendUrl`). Without that backend configured, "Connect"
// will redirect and come back with a code but can't finish the exchange.

export type SocialPlatform = "facebook" | "instagram" | "linkedin" | "tiktok";

export const socialOAuthRedirectUri = (): string =>
  `${window.location.origin}${window.location.pathname}#/social-oauth-callback`;

export const buildSocialAuthorizeUrl = (
  platform: SocialPlatform,
  clientId: string,
  state: string
): string => {
  const redirectUri = socialOAuthRedirectUri();
  switch (platform) {
    case "facebook":
    case "instagram":
      return `https://www.facebook.com/v19.0/dialog/oauth?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish",
        response_type: "code",
        state,
      })}`;
    case "linkedin":
      return `https://www.linkedin.com/oauth/v2/authorization?${new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "w_member_social openid profile",
        state,
      })}`;
    case "tiktok":
      return `https://www.tiktok.com/v2/auth/authorize?${new URLSearchParams({
        client_key: clientId,
        response_type: "code",
        scope: "video.publish,user.info.basic",
        redirect_uri: redirectUri,
        state,
      })}`;
  }
};

export interface SocialOAuthToken {
  accessToken: string;
  expiresAt?: number;
  extra?: Record<string, unknown>;
}

// Exchanges the authorization `code` for an access token via a self-hosted
// backend proxy (same convention as googleBackendUrl) — required because the
// client secret can't be exposed in the browser.
export const exchangeSocialOAuthCode = async (
  backendUrl: string,
  platform: SocialPlatform,
  code: string
): Promise<SocialOAuthToken | null> => {
  if (!backendUrl) return null;
  try {
    const res = await fetch(`${backendUrl}/oauth/${platform}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirectUri: socialOAuthRedirectUri() }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token?: string; expires_in?: number; [k: string]: unknown };
    if (!data?.access_token) return null;
    return { accessToken: data.access_token, expiresAt: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : undefined, extra: data };
  } catch { return null; }
};

// ─── Real posting (only for platforms whose APIs accept plain text) ────────
// Instagram and TikTok require hosted media (images/video) to publish via
// their APIs — this app's photos are local data URIs, not public URLs, so
// those two still rely on the existing share-sheet/clipboard fallback even
// once "connected". Facebook Pages and LinkedIn accept plain text posts, so
// those post for real once a direct token is connected.

export const postToFacebookPage = async (accessToken: string, pageId: string, message: string): Promise<void> => {
  const res = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: accessToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Facebook error ${res.status}`);
  }
};

export const postToLinkedIn = async (accessToken: string, authorUrn: string, text: string): Promise<void> => {
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `LinkedIn error ${res.status}`);
  }
};

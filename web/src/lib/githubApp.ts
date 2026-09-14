// GitHub App authentication for the webhook path. A push webhook acts as the
// App installation (not a user), so it mints a short-lived installation access
// token from the App's private key. All of this is inert until the App
// credentials (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY) are set.
import { createSign } from "crypto";

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

// A ~9-minute App JWT (RS256), signed with the App private key. GitHub allows a
// 10-minute max; we back-date iat by 60s to tolerate clock skew.
function appJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const data = `${header}.${payload}`;
  // Env vars often carry the PEM with literal "\n"; restore real newlines.
  const pem = privateKey.includes("\\n") ? privateKey.replace(/\\n/g, "\n") : privateKey;
  const sig = createSign("RSA-SHA256").update(data).sign(pem).toString("base64url");
  return `${data}.${sig}`;
}

// Exchange the App JWT for an installation access token. Returns null on failure.
export async function installationToken(
  appId: string,
  privateKey: string,
  installationId: number | string,
): Promise<string | null> {
  try {
    const jwt = appJwt(appId, privateKey);
    const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "grain-cloud",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { token?: string };
    return body.token ?? null;
  } catch {
    return null;
  }
}

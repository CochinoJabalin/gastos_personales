import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export type AuthResult =
  | { authenticated: true; method: "session" | "api-token" }
  | { authenticated: false; error: string };

export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  const apiToken = process.env.API_TOKEN;
  if (apiToken) {
    const authHeader = request.headers.get("authorization");
    const apiKeyHeader = request.headers.get("x-api-key");

    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (bearerToken === apiToken || apiKeyHeader === apiToken) {
      return { authenticated: true, method: "api-token" };
    }
  }

  const session = await getServerSession(authOptions);
  if (session) {
    return { authenticated: true, method: "session" };
  }

  return { authenticated: false, error: "No autorizado" };
}

export function verifyCSRF(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host") || "";

  const nexAuthUrl = process.env.NEXTAUTH_URL;

  const allowedOrigins = [nexAuthUrl, `http://${host}`, `https://${host}`].filter(Boolean) as string[];

  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  if (!requestOrigin) return false;

  return allowedOrigins.some((allowed) => {
    try {
      const allowedUrl = new URL(allowed);
      const reqUrl = new URL(requestOrigin);
      return (
        allowedUrl.protocol === reqUrl.protocol &&
        allowedUrl.hostname === reqUrl.hostname &&
        allowedUrl.port === reqUrl.port
      );
    } catch {
      return requestOrigin === allowed;
    }
  });
}

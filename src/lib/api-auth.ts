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

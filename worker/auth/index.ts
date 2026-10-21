import type { Env, FetchImpl } from "../upstream";
import { handleCsrf } from "./csrf";
import { handleGoogleCallback, handleGoogleStart, handleWpCallback } from "./google";
import { handleLogin } from "./login";
import { handleLogout } from "./logout";
import { handleMe } from "./me";
import { BODY_NOT_FOUND, authJson } from "./responses";
import { handleSignup, handleUsernameCheck } from "./signup";

export type AuthDeps = {
  fetchImpl: FetchImpl;
  bsiBaseUrl?: string;
};

/**
 * Route /api/auth/* — exact paths from §5.1.
 * Returns null if the path is not an auth route (caller should 404).
 */
export async function handleAuth(
  request: Request,
  env: Env,
  deps: AuthDeps,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;

  if (path === "/api/auth/csrf") return handleCsrf(request, env);
  if (path === "/api/auth/login") {
    return handleLogin(request, env, deps.fetchImpl, { bsiBaseUrl: deps.bsiBaseUrl });
  }
  if (path === "/api/auth/logout") {
    return handleLogout(request, env, deps.fetchImpl, { bsiBaseUrl: deps.bsiBaseUrl });
  }
  if (path === "/api/auth/signup") {
    return handleSignup(request, env, deps.fetchImpl, { bsiBaseUrl: deps.bsiBaseUrl });
  }
  if (path === "/api/auth/username-check") {
    return handleUsernameCheck(request, env, deps.fetchImpl, {
      bsiBaseUrl: deps.bsiBaseUrl,
    });
  }
  if (path === "/api/auth/me") return handleMe(request, env);
  if (path === "/api/auth/google/start") return handleGoogleStart(request, env);
  if (path === "/api/auth/google/callback") {
    return handleGoogleCallback(request, env, deps.fetchImpl, {
      bsiBaseUrl: deps.bsiBaseUrl,
    });
  }
  if (path === "/api/auth/callback") return handleWpCallback(request, env);

  // /api/auth/refresh dropped (R5) → JSON 404 like other unknown auth paths.
  if (path.startsWith("/api/auth/")) {
    return authJson(BODY_NOT_FOUND, 404);
  }
  return null;
}

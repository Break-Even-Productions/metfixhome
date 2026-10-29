/**
 * B2: comment writes on the staging preview host reuse isAllowedAuthOrigin.
 */
import { describe, expect, it } from "vitest";
import { handleCommentsRoutes } from "./comments";
import type { FetchImpl } from "./upstream";
import {
  H_OK,
  POST_BODY,
  TOK,
  okComment,
  seedSession,
  setupGate,
  useGateHooks,
} from "../tools/pr2/harness/comment-write-harness";

useGateHooks();

const PREVIEW_HOST = "staging-metfixhome.wispy-mode-982d.workers.dev";
const PREVIEW_ORIGIN = `https://${PREVIEW_HOST}`;

describe("comment write on staging preview host", () => {
  it("POST succeeds with STAGING_AUTH_HOSTS + preview Host/Origin", async () => {
    const g = setupGate();
    g.env.STAGING_AUTH_HOSTS = PREVIEW_HOST;
    const s = await seedSession(g);

    g.fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: PREVIEW_HOST,
        });
      }
      if (String(url).includes("/daily-fix/comments") && init?.method === "POST") {
        return Response.json(okComment({ id: 77, content: "hello" }), { status: 201 });
      }
      return new Response("{}", { status: 404 });
    });

    const res = await handleCommentsRoutes(
      new Request(`https://${PREVIEW_HOST}/api/daily-fix/comments`, {
        method: "POST",
        headers: {
          ...H_OK(s),
          Host: PREVIEW_HOST,
          Origin: PREVIEW_ORIGIN,
        },
        body: JSON.stringify({ ...POST_BODY, recaptcha: TOK }),
      }),
      g.env,
      {
        fetchImpl: g.fetchMock as unknown as FetchImpl,
        cachesDefault: g.cache,
      },
    );

    expect(res).not.toBeNull();
    expect(res!.status).toBe(201);
    expect(await res!.json()).toEqual(okComment({ id: 77, content: "hello" }));
  });

  it("POST 403 when preview Host is allowed but Origin is not", async () => {
    const g = setupGate();
    g.env.STAGING_AUTH_HOSTS = PREVIEW_HOST;
    const s = await seedSession(g);

    const res = await handleCommentsRoutes(
      new Request(`https://${PREVIEW_HOST}/api/daily-fix/comments`, {
        method: "POST",
        headers: {
          ...H_OK(s),
          Host: PREVIEW_HOST,
          Origin: "https://evil.example",
        },
        body: JSON.stringify(POST_BODY),
      }),
      g.env,
      {
        fetchImpl: g.fetchMock as unknown as FetchImpl,
        cachesDefault: g.cache,
      },
    );

    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect(await res!.json()).toEqual({ error: "forbidden" });
  });
});

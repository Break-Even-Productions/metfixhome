import https from "node:https";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

type RequestOptions = https.RequestOptions & {
  hostname?: string;
  path?: string;
  href?: string;
  headers?: Record<string, string>;
};

function jsonResponse(body: unknown): IncomingMessage {
  const stream = Readable.from([Buffer.from(JSON.stringify(body))]);
  const response = stream as IncomingMessage;
  response.statusCode = 200;
  response.headers = { "content-type": "application/json" };
  response.socket = { remoteAddress: "127.0.0.1" } as IncomingMessage["socket"];
  return response;
}

describe("sanity course fetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("requests published courses on the API CDN without credentials", async () => {
    const calls: RequestOptions[] = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    vi.spyOn(https, "request").mockImplementation(((
      options: RequestOptions,
      callback?: (res: IncomingMessage) => void,
    ) => {
      calls.push(options);
      const req = {
        finished: false,
        setHeader() {},
        removeHeader() {},
        getHeader(name: string) {
          return options.headers?.[name];
        },
        setTimeout() {
          return req;
        },
        abort() {},
        destroy() {},
        once() {
          return req;
        },
        on() {
          return req;
        },
        write() {},
        end() {
          const courses = Array.from({ length: 9 }, (_, index) => ({
            _id: `course-${index + 1}`,
            title: `Course ${index + 1}`,
            slug: { current: `course-${index + 1}` },
          }));
          const body = {
            result: [...courses, { _id: "drafts.unpublished-course" }],
          };
          queueMicrotask(() => callback?.(jsonResponse(body)));
        },
      };
      return req;
    }) as typeof https.request);

    const { fetchCourses } = await import("./content");
    const { sanityClient } = await import("./sanity");
    const courses = await fetchCourses();

    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(fetchSpy).not.toHaveBeenCalled();

    expect(sanityClient).not.toBeNull();
    // Bites on withCredentials:true in createClient without depending on host/CDN.
    expect(sanityClient!.config().withCredentials).toBeFalsy();

    const options = calls[0];
    const host = options.hostname || options.host;
    const path = options.path || "";
    const url = new URL(options.href || `https://${host}${path}`);
    expect(url.host).toBe("etg9lezr.apicdn.sanity.io");
    expect(url.pathname).toContain("/data/query/production");
    expect(url.searchParams.get("perspective")).toBe("published");
    const query = url.searchParams.get("query") || "";
    expect(query).toContain('*[_type == "course"]');
    expect(query).not.toContain("drafts.**");
    expect(new Headers(options.headers).has("authorization")).toBe(false);
    expect(url.searchParams.has("token")).toBe(false);
    expect(url.searchParams.has("access_token")).toBe(false);
    expect(courses).toHaveLength(9);
    expect(courses.every((course) => !course.id.startsWith("drafts."))).toBe(true);
  });
});

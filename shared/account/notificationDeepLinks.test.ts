import { describe, expect, it } from "vitest";
import { externalNotificationHref, resolveNotificationHref } from "./notificationDeepLinks";

describe("resolveNotificationHref", () => {
  it("maps messaging notifications to /account/messages/:id", () => {
    expect(
      resolveNotificationHref({
        type: "messaging",
        link: "/messages/42",
        post_id: 42,
      }),
    ).toBe("/account/messages/42");
    expect(
      resolveNotificationHref({
        type: "messaging",
        link: null,
        post_id: 99,
      }),
    ).toBe("/account/messages/99");
    expect(resolveNotificationHref({ type: "chat", link: null, post_id: null })).toBe(
      "/account/chat",
    );
  });

  it("maps daily fix notifications to /the-daily-fix/YY/MM/DD", () => {
    expect(
      resolveNotificationHref({
        type: "dfx_daily",
        link: "/fix/25/11/07",
      }),
    ).toBe("/the-daily-fix/25/11/07");
    expect(
      resolveNotificationHref({
        type: "dfx_daily",
        link: "https://brokenscience.org/fix/25/11/07/?tab=belly#comment-3",
      }),
    ).toBe("/the-daily-fix/25/11/07?tab=belly#comment-3");
    expect(resolveNotificationHref({ type: "dfx_daily", link: null })).toBe(
      "/the-daily-fix",
    );
  });

  it("maps post notifications to /posts/:id", () => {
    expect(
      resolveNotificationHref({
        type: "new_post",
        post_id: 88,
        link: "https://brokenscience.org/some-slug/",
      }),
    ).toBe("/posts/88");
    expect(
      resolveNotificationHref({
        type: "post",
        link: "/posts/12",
        post_id: null,
      }),
    ).toBe("/posts/12");
  });

  it("prefers an already-shaped site href", () => {
    expect(
      resolveNotificationHref({
        type: "messaging",
        href: "/account/messages/7",
        link: "/messages/7",
      }),
    ).toBe("/account/messages/7");
  });

  it("keeps a newsletter link as an external http(s) URL", () => {
    expect(externalNotificationHref("https://mailchi.mp/metfix/march")).toBe(
      "https://mailchi.mp/metfix/march",
    );
    expect(externalNotificationHref("javascript:alert(1)")).toBeNull();
    expect(externalNotificationHref("https://user:pass@example.com/letter")).toBeNull();
    expect(resolveNotificationHref({ type: "new_newsletter", link: "https://mailchi.mp/metfix/march" })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  LOGIN_BODY_KEYS,
  SIGNUP_BODY_KEYS,
  buildLoginBody,
  buildSignupBody,
} from "./auth-bodies";

describe("auth-bodies contract (B1)", () => {
  it("login keys are identifier/password/recaptcha", () => {
    const body = buildLoginBody({
      identifier: "  pat@example.com ",
      password: "secret",
      recaptcha: "tok",
    });
    expect(body).toEqual({
      identifier: "pat@example.com",
      password: "secret",
      recaptcha: "tok",
    });
    expect(Object.keys(body).sort()).toEqual([...LOGIN_BODY_KEYS].sort());
  });

  it("signup keys are username/email/recaptcha (no password)", () => {
    const body = buildSignupBody({
      username: " pat ",
      email: " pat@example.com ",
      recaptcha: "tok",
    });
    expect(body).toEqual({
      username: "pat",
      email: "pat@example.com",
      recaptcha: "tok",
    });
    expect(Object.keys(body).sort()).toEqual([...SIGNUP_BODY_KEYS].sort());
    expect(body).not.toHaveProperty("password");
  });
});

/**
 * Shared login/signup body shapes — client and Worker must agree (CQ B1).
 * Field name is `recaptcha` (not `recaptcha_token`).
 */

export type LoginBody = {
  identifier: string;
  password: string;
  recaptcha: string;
};

export type SignupBody = {
  username: string;
  email: string;
  recaptcha: string;
};

export function buildLoginBody(input: {
  identifier: string;
  password: string;
  recaptcha: string;
}): LoginBody {
  return {
    identifier: input.identifier.trim(),
    password: input.password,
    recaptcha: input.recaptcha,
  };
}

export function buildSignupBody(input: {
  username: string;
  email: string;
  recaptcha: string;
}): SignupBody {
  return {
    username: input.username.trim(),
    email: input.email.trim(),
    recaptcha: input.recaptcha,
  };
}

/** Keys the Worker actually reads — contract tests assert against these. */
export const LOGIN_BODY_KEYS = ["identifier", "password", "recaptcha"] as const;
export const SIGNUP_BODY_KEYS = ["username", "email", "recaptcha"] as const;

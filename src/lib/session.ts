import { SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn: boolean;
  username: string;
}

export function getSessionOptions(): SessionOptions {
  return {
    password:
      process.env.SESSION_SECRET ?? "fallback-dev-secret-must-change-32chars!",
    cookieName: "cf_usage_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  };
}

// For proxy.ts which needs the cookie name without a full options object
export const SESSION_COOKIE_NAME = "cf_usage_session";


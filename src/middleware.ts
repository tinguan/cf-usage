import { NextRequest, NextResponse } from "next/server";
import { unsealData } from "iron-session";
import { SessionData, SESSION_COOKIE_NAME } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Allow cron worker to call /api/sync with a valid shared secret
  if (pathname === "/api/sync" && request.method === "POST") {
    const cronSecret = request.headers.get("x-cron-secret");
    const sessionSecret = process.env.SESSION_SECRET;
    if (cronSecret && sessionSecret && cronSecret === sessionSecret) {
      return NextResponse.next();
    }
  }

  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let isLoggedIn = false;

  if (cookieValue) {
    try {
      const session = await unsealData<SessionData>(cookieValue, {
        password:
          process.env.SESSION_SECRET ??
          "fallback-dev-secret-must-change-32chars!",
      });
      isLoggedIn = session.isLoggedIn === true;
    } catch {
      isLoggedIn = false;
    }
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

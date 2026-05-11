import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SessionData, getSessionOptions } from "@/lib/session";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 }
    );
  }

  const expectedUser = process.env.CF_DASHBOARD_USER ?? "";
  const expectedPass = process.env.CF_DASHBOARD_PASS ?? "";

  // Constant-time comparison (Web Crypto compatible, no Node:crypto)
  const userMatch = safeCompare(username, expectedUser);
  const passMatch = safeCompare(password, expectedPass);

  if (!userMatch || !passMatch) {
    // Fixed delay to prevent timing-based user enumeration
    await new Promise((r) => setTimeout(r, 300));
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const session = await getIronSession<SessionData>(
    await cookies(),
    getSessionOptions()
  );
  session.isLoggedIn = true;
  session.username = username;
  await session.save();

  return NextResponse.json({ ok: true });
}

/** Constant-time string comparison — no Node.js crypto dependency */
function safeCompare(a: string, b: string): boolean {
  const enc = new TextEncoder();
  // Pad both to 512 bytes to avoid length-timing oracle
  const bufA = enc.encode(a.padEnd(512, "\0"));
  const bufB = enc.encode(b.padEnd(512, "\0"));
  let acc = 0;
  for (let i = 0; i < bufA.length; i++) {
    acc |= bufA[i] ^ bufB[i];
  }
  // Also ensure original lengths match
  acc |= a.length ^ b.length;
  return acc === 0;
}


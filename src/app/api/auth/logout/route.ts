import { NextResponse } from "next/server";
import { deleteCookieConfig } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  const cookie = deleteCookieConfig();
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    maxAge: cookie.maxAge,
  });
  return response;
}

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "auth-token";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];
const ADMIN_ONLY_PATHS = ["/cadastro", "/relatorios"];

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Allow all API routes except auth-related ones (they use service role key)
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Check for auth token
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const perfil = payload.perfil as string;

    // Check admin-only routes
    if (ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      if (perfil !== "admin") {
        return NextResponse.redirect(new URL("/fechamento", request.url));
      }
    }

    // Authenticated user on /login → redirect to app
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/fechamento", request.url));
    }

    return NextResponse.next();
  } catch {
    // Invalid token
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Token invalido" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

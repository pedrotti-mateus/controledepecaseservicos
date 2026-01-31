import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

export interface AuthPayload extends JWTPayload {
  sub: string;
  usuario: string;
  perfil: "admin" | "colaborador";
}

const COOKIE_NAME = "auth-token";
const EXPIRATION = "7d";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: {
  id: string;
  usuario: string;
  perfil: "admin" | "colaborador";
}): Promise<string> {
  return new SignJWT({
    usuario: payload.usuario,
    perfil: payload.perfil,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.id)
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(getSecret());
}

export async function verifyToken(
  token: string
): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as AuthPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AuthPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function authCookieConfig(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function deleteCookieConfig() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

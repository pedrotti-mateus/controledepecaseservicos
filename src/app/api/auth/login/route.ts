import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase";
import { signToken, authCookieConfig } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { usuario, senha } = await request.json();

    if (!usuario || !senha) {
      return NextResponse.json(
        { error: "Usuario e senha sao obrigatorios" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, usuario, senha_hash, perfil")
      .eq("usuario", usuario.toLowerCase().trim())
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Usuario ou senha invalidos" },
        { status: 401 }
      );
    }

    const senhaValida = await bcrypt.compare(senha, data.senha_hash);
    if (!senhaValida) {
      return NextResponse.json(
        { error: "Usuario ou senha invalidos" },
        { status: 401 }
      );
    }

    const token = await signToken({
      id: String(data.id),
      usuario: data.usuario,
      perfil: data.perfil,
    });

    const response = NextResponse.json({
      success: true,
      usuario: data.usuario,
      perfil: data.perfil,
    });

    const cookie = authCookieConfig(token);
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAge,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Nao autenticado" },
        { status: 401 }
      );
    }

    const { senha_atual, senha_nova } = await request.json();

    if (!senha_atual || !senha_nova) {
      return NextResponse.json(
        { error: "Senha atual e nova senha sao obrigatorias" },
        { status: 400 }
      );
    }

    if (senha_nova.length < 6) {
      return NextResponse.json(
        { error: "A nova senha deve ter pelo menos 6 caracteres" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data: user, error: fetchError } = await supabase
      .from("usuarios")
      .select("id, senha_hash")
      .eq("id", parseInt(session.sub!))
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: "Usuario nao encontrado" },
        { status: 404 }
      );
    }

    const senhaValida = await bcrypt.compare(senha_atual, user.senha_hash);
    if (!senhaValida) {
      return NextResponse.json(
        { error: "Senha atual incorreta" },
        { status: 401 }
      );
    }

    const novoHash = await bcrypt.hash(senha_nova, 10);
    const { error: updateError } = await supabase
      .from("usuarios")
      .update({
        senha_hash: novoHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

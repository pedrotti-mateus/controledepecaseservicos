import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (no dotenv dependency needed)
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  const hash = await bcrypt.hash("Guerra@2026", 10);

  const { error } = await supabase.from("usuarios").upsert(
    [
      { usuario: "admin", senha_hash: hash, perfil: "admin" },
      { usuario: "pedrotti", senha_hash: hash, perfil: "colaborador" },
    ],
    { onConflict: "usuario" }
  );

  if (error) {
    console.error("Erro ao inserir usuarios:", error.message);
    process.exit(1);
  }

  console.log("Usuarios criados com sucesso:");
  console.log("  admin / Guerra@2026 (admin)");
  console.log("  pedrotti / Guerra@2026 (colaborador)");
}

seed();

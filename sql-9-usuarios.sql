-- Tabela de usuarios para autenticacao local
CREATE TABLE usuarios (
  id BIGSERIAL PRIMARY KEY,
  usuario TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'colaborador')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_usuario ON usuarios (usuario);

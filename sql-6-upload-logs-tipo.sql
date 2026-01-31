-- Adicionar coluna 'tipo' na tabela upload_logs para identificar o tipo de upload
ALTER TABLE upload_logs ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'pecas_servicos';

-- Atualizar registros existentes (todos sao pecas_servicos exceto os que tem storage_path com 'mecanicos/')
UPDATE upload_logs SET tipo = 'mecanicos' WHERE storage_path LIKE 'mecanicos/%';

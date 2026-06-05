CREATE TABLE IF NOT EXISTS gestao_de_pneu (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  usuario VARCHAR(60) NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  perfil VARCHAR(20) NOT NULL DEFAULT 'motorista',
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  aprovado_por BIGINT REFERENCES gestao_de_pneu(id),
  aprovado_em TIMESTAMP,
  recusado_em TIMESTAMP,
  ultimo_login TIMESTAMP,
  pode_cadastrar BOOLEAN NOT NULL DEFAULT TRUE,
  pode_relatorios BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_perfil_gestao_pneu
    CHECK (perfil IN ('admin', 'assistente', 'motorista')),
  CONSTRAINT chk_status_gestao_pneu
    CHECK (status IN ('pendente', 'aprovado', 'recusado', 'bloqueado'))
);

CREATE INDEX IF NOT EXISTS idx_gestao_de_pneu_status
ON gestao_de_pneu (status);

CREATE INDEX IF NOT EXISTS idx_gestao_de_pneu_perfil
ON gestao_de_pneu (perfil);

CREATE INDEX IF NOT EXISTS idx_gestao_de_pneu_usuario_status
ON gestao_de_pneu (usuario, status);

ALTER TABLE gestao_de_pneu
ADD COLUMN IF NOT EXISTS pode_cadastrar BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE gestao_de_pneu
ADD COLUMN IF NOT EXISTS pode_relatorios BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE gestao_de_pneu
DROP CONSTRAINT IF EXISTS chk_perfil_gestao_pneu;

UPDATE gestao_de_pneu
SET perfil = 'admin'
WHERE perfil IN ('administrador', 'adm');

UPDATE gestao_de_pneu
SET perfil = 'assistente'
WHERE perfil = 'operacional';

ALTER TABLE gestao_de_pneu
ADD CONSTRAINT chk_perfil_gestao_pneu
CHECK (perfil IN ('admin', 'assistente', 'motorista'));

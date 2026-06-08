const db = require('../config/db');
const { executarSchemaSync } = require('../utils/schemaGuard');

const STATUS = ['pendente', 'aprovado', 'recusado'];
const TIPOS = ['SemAlteracao', 'Troca', 'Instalacao', 'Retirada', 'Atualizacao', 'Baixa'];

let tableReadyPromise = null;

function perfilNormalizado(usuario) {
  const perfil = String(usuario?.perfil || '').toLowerCase();
  if (['admin', 'administrador', 'adm'].includes(perfil)) return 'admin';
  if (perfil === 'motorista') return 'motorista';
  return 'assistente';
}

function podeGerenciar(req) {
  return perfilNormalizado(req.usuario) !== 'motorista';
}

function statusNormalizado(status) {
  const s = String(status || '').trim().toLowerCase();
  return STATUS.includes(s) ? s : '';
}

function tipoNormalizado(tipo) {
  const t = String(tipo || '').trim();
  return TIPOS.includes(t) ? t : 'SemAlteracao';
}

function dataIso(v) {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function dataFutura(data) {
  const d = new Date(`${String(data).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return true;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return d > hoje;
}

function parseItens(itens) {
  if (Array.isArray(itens)) return itens;
  if (typeof itens === 'string') {
    try {
      const parsed = JSON.parse(itens);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapConferencia(row) {
  return {
    id: Number(row.id),
    dataConferencia: dataIso(row.data_conferencia),
    motoristaNome: row.motorista_nome || '',
    motoristaUsuario: row.motorista_usuario || '',
    veiculo: row.placa_veiculo || '',
    kmVeiculo: Number(row.km_veiculo) || 0,
    tipo: row.tipo || 'SemAlteracao',
    status: row.status || 'pendente',
    itens: parseItens(row.itens),
    observacao: row.observacao || '',
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    aprovadoPor: row.aprovado_por || '',
    aprovadoEm: row.aprovado_em,
    recusadoPor: row.recusado_por || '',
    recusadoEm: row.recusado_em,
    motivoRecusa: row.motivo_recusa || ''
  };
}

async function garantirTabelaConferencias() {
  if (!tableReadyPromise) {
    tableReadyPromise = executarSchemaSync('Conferencias_Pneus', () => db.query(`
      CREATE TABLE IF NOT EXISTS "Conferencias_Pneus" (
        id BIGSERIAL PRIMARY KEY,
        data_conferencia DATE NOT NULL,
        motorista_nome VARCHAR(120),
        motorista_usuario VARCHAR(80),
        placa_veiculo VARCHAR(30) NOT NULL,
        km_veiculo DOUBLE PRECISION NOT NULL DEFAULT 0,
        tipo VARCHAR(30) NOT NULL DEFAULT 'SemAlteracao',
        status VARCHAR(20) NOT NULL DEFAULT 'pendente',
        itens JSONB NOT NULL DEFAULT '[]'::jsonb,
        observacao TEXT,
        criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
        aprovado_por VARCHAR(120),
        aprovado_em TIMESTAMP,
        recusado_por VARCHAR(120),
        recusado_em TIMESTAMP,
        motivo_recusa TEXT,
        CONSTRAINT chk_status_conferencias_pneus
          CHECK (status IN ('pendente', 'aprovado', 'recusado')),
        CONSTRAINT chk_tipo_conferencias_pneus
          CHECK (tipo IN ('SemAlteracao', 'Troca', 'Instalacao', 'Retirada', 'Atualizacao', 'Baixa'))
      );

      CREATE INDEX IF NOT EXISTS idx_conferencias_pneus_status
      ON "Conferencias_Pneus" (status);

      CREATE INDEX IF NOT EXISTS idx_conferencias_pneus_motorista
      ON "Conferencias_Pneus" (motorista_usuario);

      CREATE INDEX IF NOT EXISTS idx_conferencias_pneus_veiculo
      ON "Conferencias_Pneus" (placa_veiculo);
    `));
  }

  return tableReadyPromise;
}

class ConferenciaController {
  async listar(req, res) {
    try {
      await garantirTabelaConferencias();

      const status = statusNormalizado(req.query.status);
      const params = [];
      const where = [];

      if (status) {
        params.push(status);
        where.push(`status = $${params.length}`);
      }

      if (!podeGerenciar(req)) {
        params.push(req.usuario?.usuario || '');
        where.push(`motorista_usuario = $${params.length}`);
      }

      const { rows } = await db.query(`
        SELECT *
        FROM "Conferencias_Pneus"
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY
          CASE status WHEN 'pendente' THEN 1 WHEN 'aprovado' THEN 2 ELSE 3 END,
          data_conferencia DESC,
          id DESC
        LIMIT 300
      `, params);

      return res.json(rows.map(mapConferencia));
    } catch (error) {
      console.error('Erro ao listar conferencias:', error);
      return res.status(500).json({ error: 'Erro interno ao listar conferencias.' });
    }
  }

  async criar(req, res) {
    try {
      await garantirTabelaConferencias();

      const dataConferencia = dataIso(req.body.dataConferencia || req.body.data_conferencia);
      const veiculo = String(req.body.veiculo || req.body.placa_veiculo || '').trim().toUpperCase();
      const kmVeiculo = Number(req.body.kmVeiculo || req.body.km_veiculo || 0) || 0;
      const tipo = tipoNormalizado(req.body.tipo);
      const itens = parseItens(req.body.itens);
      const observacao = String(req.body.observacao || '').trim();

      if (!dataConferencia || dataFutura(dataConferencia)) {
        return res.status(400).json({ error: 'Informe uma data valida para a conferencia.' });
      }
      if (!veiculo) return res.status(400).json({ error: 'Informe o veiculo da conferencia.' });
      if (kmVeiculo <= 0) return res.status(400).json({ error: 'Informe o KM atual do veiculo.' });
      if (tipo !== 'SemAlteracao' && !itens.length) {
        return res.status(400).json({ error: 'Inclua pelo menos uma alteracao na conferencia.' });
      }

      const usuario = req.usuario || {};
      const { rows } = await db.query(`
        INSERT INTO "Conferencias_Pneus" (
          data_conferencia, motorista_nome, motorista_usuario, placa_veiculo,
          km_veiculo, tipo, status, itens, observacao
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pendente', $7::jsonb, $8)
        RETURNING *
      `, [
        dataConferencia,
        usuario.nome || usuario.usuario || '',
        usuario.usuario || '',
        veiculo,
        kmVeiculo,
        tipo,
        JSON.stringify(itens),
        observacao
      ]);

      return res.status(201).json(mapConferencia(rows[0]));
    } catch (error) {
      console.error('Erro ao criar conferencia:', error);
      return res.status(500).json({ error: 'Erro interno ao criar conferencia.' });
    }
  }

  async atualizarStatus(req, res) {
    try {
      await garantirTabelaConferencias();

      if (!podeGerenciar(req)) {
        return res.status(403).json({ error: 'Somente administradores e assistentes podem aprovar conferencias.' });
      }

      const id = Number(req.params.id);
      const status = statusNormalizado(req.body.status);
      const motivo = String(req.body.motivo || '').trim();
      const responsavel = req.usuario?.nome || req.usuario?.usuario || '';

      if (!id) return res.status(400).json({ error: 'Conferencia invalida.' });
      if (!['aprovado', 'recusado', 'pendente'].includes(status)) {
        return res.status(400).json({ error: 'Status invalido.' });
      }

      const { rows } = await db.query(`
        UPDATE "Conferencias_Pneus"
        SET
          status = $1,
          aprovado_por = CASE WHEN $1 = 'aprovado' THEN $2 ELSE aprovado_por END,
          aprovado_em = CASE WHEN $1 = 'aprovado' THEN NOW() ELSE aprovado_em END,
          recusado_por = CASE WHEN $1 = 'recusado' THEN $2 ELSE recusado_por END,
          recusado_em = CASE WHEN $1 = 'recusado' THEN NOW() ELSE recusado_em END,
          motivo_recusa = CASE WHEN $1 = 'recusado' THEN $3 ELSE motivo_recusa END,
          atualizado_em = NOW()
        WHERE id = $4
        RETURNING *
      `, [status, responsavel, motivo, id]);

      if (!rows.length) return res.status(404).json({ error: 'Conferencia nao encontrada.' });
      return res.json(mapConferencia(rows[0]));
    } catch (error) {
      console.error('Erro ao atualizar conferencia:', error);
      return res.status(500).json({ error: 'Erro interno ao atualizar conferencia.' });
    }
  }
}

module.exports = new ConferenciaController();

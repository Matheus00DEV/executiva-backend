const db = require('../config/db');
const { executarSchemaSync } = require('../utils/schemaGuard');
const { erroInterno } = require('../utils/httpResponse');

let compraColumnsReady = false;
let compraColumns = {
  FornecedorCompra: false,
  NotaFiscalCompra: false,
  ObsCompra: false
};

async function ensureCompraColumns() {
  if (compraColumnsReady) return;
  await executarSchemaSync('Pneus_Frota.colunas_compra', () => db.query(`
    ALTER TABLE "Pneus_Frota"
      ADD COLUMN IF NOT EXISTS "FornecedorCompra" TEXT,
      ADD COLUMN IF NOT EXISTS "NotaFiscalCompra" TEXT,
      ADD COLUMN IF NOT EXISTS "ObsCompra" TEXT
  `));

  const { rows } = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = CURRENT_SCHEMA()
      AND table_name = 'Pneus_Frota'
      AND column_name = ANY($1)
  `, [Object.keys(compraColumns)]);

  const existentes = new Set(rows.map(row => row.column_name));
  compraColumns = {
    FornecedorCompra: existentes.has('FornecedorCompra'),
    NotaFiscalCompra: existentes.has('NotaFiscalCompra'),
    ObsCompra: existentes.has('ObsCompra')
  };
  compraColumnsReady = true;
}

function compraSelect(columnName, alias) {
  return compraColumns[columnName]
    ? `COALESCE(p."${columnName}", '') AS "${alias}"`
    : `'' AS "${alias}"`;
}

function appendCompraColumn(columns, values, params, columnName, value) {
  if (!compraColumns[columnName]) return;
  columns.push(`"${columnName}"`);
  params.push(value);
  values.push(`$${params.length}`);
}

class PneuController {
  mapPneu(row) {
    return {
      id: row.CodPneu,
      codSistema: row.CodPneu,
      numPneu: row.NPneu,
      marcaCodigo: row.Marca,
      marca: row.Marca,
      modelo: row.Modelo,
      tipo: row.TipoPneu,
      medida: row.Largura,
      dataCompra: row.DataCompra,
      valorCompra: row.VlCompra,
      kmCompra: row.KmCompra,
      dot: row.Dot,
      serie: row.Serie,
      fornecedorCompra: row.FornecedorCompra || '',
      notaFiscalCompra: row.NotaFiscalCompra || '',
      observacaoCompra: row.ObsCompra || '',
      profundidadeAtual: row.Profundidademm,
      statusAtual: row.Status || 'Estoque',
      veiculoAtual: !row.VeiculoAtual || row.VeiculoAtual === '0' ? 'Estoque' : row.VeiculoAtual,
      localAtual: !row.LocalAtual || row.LocalAtual === '0' ? 'Estoque' : row.LocalAtual,
      kmRodadoTotal: row.KmPercorrido || 0,
      quantidadeRecapagens: Number(row.QtdeRecapagem) || 0
    };
  }

  async getPneus(req, res) {
    try {
      await ensureCompraColumns();
      const { rows } = await db.query(`
        WITH ultima_mov AS (
          SELECT DISTINCT ON ("CodPneu")
            "CodPneu",
            "TipoMov"
          FROM "Pneus_Mov_Frota"
          ORDER BY "CodPneu", "Data" DESC NULLS LAST, "CodMovPneu" DESC
        ),
        resumo_mov AS (
          SELECT
            "CodPneu",
            MIN(NULLIF(CASE WHEN "Km" > 1000 THEN "Km" ELSE NULL END, 0)) AS km_min,
            MAX(NULLIF(CASE WHEN "Km" > 1000 THEN "Km" ELSE NULL END, 0)) AS km_max,
            COALESCE(SUM(CASE WHEN "TipoMov" = '2' THEN "VlRecape" ELSE 0 END), 0) AS custo_recapagens,
            (COUNT(*) FILTER (WHERE "TipoMov" = '2'))::int AS qtd_recapagens
          FROM "Pneus_Mov_Frota"
          GROUP BY "CodPneu"
        )
        SELECT
          p."CodPneu" AS id,
          p."CodPneu" AS "codSistema",
          p."NPneu" AS "numPneu",
          p."Marca" AS "marcaCodigo",
          CASE
            WHEN UPPER(COALESCE(p."Modelo", '')) LIKE 'FS %' THEN 'FIRESTONE'
            WHEN UPPER(COALESCE(p."Modelo", '')) LIKE 'MULT%' THEN 'MICHELIN'
            WHEN UPPER(COALESCE(p."Modelo", '')) IN ('M736', 'R268', 'R269', 'R269Z') THEN 'BRIDGESTONE'
            WHEN UPPER(COALESCE(p."Modelo", '')) IN ('TR01', 'TR88', 'FR01', 'FR88') THEN 'PIRELLI'
            WHEN UPPER(COALESCE(p."Modelo", '')) LIKE 'SP 320%' THEN 'DUNLOP'
            WHEN UPPER(COALESCE(p."Modelo", '')) LIKE 'KMAX%' THEN 'GOODYEAR'
            WHEN UPPER(COALESCE(p."Modelo", '')) LIKE 'D722%' THEN 'STEELMARK'
            WHEN UPPER(COALESCE(p."Modelo", '')) LIKE 'EASYMAX%' THEN 'SPEEDMAX'
            WHEN p."Marca" = '1' THEN 'FIRESTONE'
            WHEN p."Marca" = '2' THEN 'MICHELIN'
            WHEN p."Marca" = '3' THEN 'BRIDGESTONE'
            WHEN p."Marca" = '4' THEN 'PIRELLI'
            WHEN p."Marca" = '6' THEN 'CONTINENTAL'
            WHEN p."Marca" = '8' THEN 'DUNLOP'
            WHEN p."Marca" = '14' THEN 'GOODYEAR'
            WHEN p."Marca" = '19' THEN 'STEELMARK'
            ELSE COALESCE(NULLIF(p."Marca", ''), 'MARCA NAO INFORMADA')
          END AS marca,
          p."Modelo" AS modelo,
          p."TipoPneu" AS tipo,
          p."Largura" AS medida,
          p."DataCompra" AS "dataCompra",
          p."VlCompra" AS "valorCompra",
          p."KmCompra" AS "kmCompra",
          p."Dot" AS dot,
          p."Serie" AS serie,
          ${compraSelect('FornecedorCompra', 'fornecedorCompra')},
          ${compraSelect('NotaFiscalCompra', 'notaFiscalCompra')},
          ${compraSelect('ObsCompra', 'observacaoCompra')},
          p."Profundidademm" AS "profundidadeAtual",
          CASE
            WHEN u."TipoMov" = '5' THEN 'Baixado'
            WHEN p."VeiculoAtual" IS NULL OR p."VeiculoAtual" = '0' THEN 'Estoque'
            ELSE 'Rodando'
          END AS "statusAtual",
          CASE
            WHEN p."VeiculoAtual" IS NULL OR p."VeiculoAtual" = '0' THEN 'Estoque'
            ELSE p."VeiculoAtual"
          END AS "veiculoAtual",
          CASE
            WHEN p."LocalAtual" IS NULL OR p."LocalAtual" = '0' THEN 'Estoque'
            ELSE p."LocalAtual"
          END AS "localAtual",
          GREATEST(
            COALESCE(NULLIF(p."KmPercorrido", 0), 0),
            CASE
              WHEN rm.km_max IS NULL THEN 0
              WHEN p."KmCompra" > 0 AND p."KmCompra" < rm.km_max THEN rm.km_max - p."KmCompra"
              WHEN rm.km_min IS NOT NULL AND rm.km_max > rm.km_min THEN rm.km_max - rm.km_min
              ELSE 0
            END
          ) AS "kmRodadoTotal",
          GREATEST(
            COALESCE(CASE WHEN p."QtdeRecapagem" ~ '^[0-9]+$' THEN p."QtdeRecapagem"::int END, 0),
            COALESCE(rm.qtd_recapagens, 0)
          ) AS "quantidadeRecapagens",
          COALESCE(rm.custo_recapagens, 0) AS "custoRecapagens"
        FROM "Pneus_Frota" p
        LEFT JOIN ultima_mov u ON u."CodPneu" = p."CodPneu"
        LEFT JOIN resumo_mov rm ON rm."CodPneu" = p."CodPneu"
        ORDER BY p."NPneu" ASC
      `);
      res.json(rows);
    } catch (error) {
      console.error('Erro ao buscar pneus:', error);
      return erroInterno(req, res, 'Erro interno ao buscar pneus.', error);
    }
  }

  async criarPneu(req, res) {
    try {
      await ensureCompraColumns();
      const pneu = req.body;
      const codPneu = String(pneu.codSistema || pneu.id || `PNEU-${Date.now()}`).trim();
      const numPneu = String(pneu.numPneu || '').trim();
      const marca = String(pneu.marca || '').trim();
      const modelo = String(pneu.modelo || '').trim();
      const dataCompra = pneu.dataCompra || null;
      const valorCompraRaw = String(pneu.valorCompra ?? '').trim();
      const kmCompraRaw = String(pneu.kmCompra ?? '').trim();

      if (!codPneu || !numPneu) {
        return res.status(400).json({ error: 'Codigo e numero do pneu sao obrigatorios.' });
      }
      if (!marca || !modelo || !valorCompraRaw || !kmCompraRaw) {
        return res.status(400).json({ error: 'Numero do pneu, marca, modelo, KM na compra e valor da compra sao obrigatorios.' });
      }

      const profundidade = Number(pneu.profundidadeAtual || pneu.profundidadeInicial || 0) || null;
      const valorCompra = Number(valorCompraRaw);
      const kmCompra = Number(kmCompraRaw);
      const fornecedorCompra = String(pneu.fornecedorCompra || '').trim();
      const notaFiscalCompra = String(pneu.notaFiscalCompra || '').trim();
      const observacaoCompra = String(pneu.observacaoCompra || '').trim();

      if (!Number.isFinite(valorCompra) || !Number.isFinite(kmCompra) ||
        (profundidade !== null && (profundidade < 0 || profundidade > 40)) ||
        (valorCompra !== null && valorCompra < 0) ||
        (kmCompra !== null && kmCompra < 0)) {
        return res.status(400).json({ error: 'Valores numericos invalidos no cadastro do pneu.' });
      }

      const duplicado = await db.query(`
        SELECT "CodPneu", "NPneu"
        FROM "Pneus_Frota"
        WHERE UPPER(TRIM("CodPneu")) = UPPER(TRIM($1))
           OR UPPER(TRIM("NPneu")) = UPPER(TRIM($2))
        LIMIT 1
      `, [codPneu, numPneu]);

      if (duplicado.rows.length) {
        return res.status(409).json({ error: 'Ja existe um pneu cadastrado com esse codigo ou numero de fogo.' });
      }

      const columns = [
        '"CodPneu"', '"NPneu"', '"Marca"', '"TipoPneu"', '"KmPercorrido"', '"VeiculoAtual"', '"LocalAtual"',
        '"Status"', '"QtdeRecapagem"', '"DataCompra"', '"Largura"', '"Modelo"', '"Dot"', '"Serie"',
        '"Profundidademm"', '"VlCompra"', '"KmCompra"'
      ];
      const values = ['$1', '$2', '$3', '$4', '0', "'0'", "'0'", "'Estoque'", "'0'", '$5', '$6', '$7', '$8', '$9', '$10', '$11', '$12'];
      const params = [
        codPneu,
        numPneu,
        marca,
        pneu.tipo || '',
        dataCompra,
        pneu.medida || '',
        modelo,
        pneu.dot || '',
        pneu.serie || '',
        profundidade,
        valorCompra,
        kmCompra
      ];

      appendCompraColumn(columns, values, params, 'FornecedorCompra', fornecedorCompra);
      appendCompraColumn(columns, values, params, 'NotaFiscalCompra', notaFiscalCompra);
      appendCompraColumn(columns, values, params, 'ObsCompra', observacaoCompra);

      const { rows } = await db.query(`
        INSERT INTO "Pneus_Frota" (${columns.join(', ')})
        VALUES (${values.join(', ')})
        RETURNING *
      `, params);

      const row = rows[0];
      res.status(201).json({
        id: row.CodPneu,
        codSistema: row.CodPneu,
        numPneu: row.NPneu,
        marcaCodigo: row.Marca,
        marca: row.Marca,
        modelo: row.Modelo,
        tipo: row.TipoPneu,
        medida: row.Largura,
        dataCompra: row.DataCompra,
        valorCompra: row.VlCompra,
        kmCompra: row.KmCompra,
        dot: row.Dot,
        serie: row.Serie,
        fornecedorCompra: row.FornecedorCompra || '',
        notaFiscalCompra: row.NotaFiscalCompra || '',
        observacaoCompra: row.ObsCompra || '',
        profundidadeAtual: row.Profundidademm,
        statusAtual: row.Status || 'Estoque',
        veiculoAtual: !row.VeiculoAtual || row.VeiculoAtual === '0' ? 'Estoque' : row.VeiculoAtual,
        localAtual: !row.LocalAtual || row.LocalAtual === '0' ? 'Estoque' : row.LocalAtual,
        kmRodadoTotal: row.KmPercorrido || 0,
        quantidadeRecapagens: Number(row.QtdeRecapagem) || 0
      });
    } catch (error) {
      console.error('Erro ao criar pneu:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ja existe um pneu com esse codigo.' });
      }
      return erroInterno(req, res, 'Erro interno ao criar pneu.', error);
    }
  }
}

module.exports = new PneuController();

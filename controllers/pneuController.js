const db = require('../config/db');

class PneuController {
  async getPneus(req, res) {
    try {
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
            WHEN UPPER(COALESCE(p."Modelo", '')) LIKE 'D722%' THEN 'DRC'
            WHEN UPPER(COALESCE(p."Modelo", '')) LIKE 'EASYMAX%' THEN 'SPEEDMAX'
            WHEN p."Marca" = '1' THEN 'FIRESTONE'
            WHEN p."Marca" = '2' THEN 'MICHELIN'
            WHEN p."Marca" = '3' THEN 'BRIDGESTONE'
            WHEN p."Marca" = '4' THEN 'PIRELLI'
            WHEN p."Marca" = '8' THEN 'DUNLOP'
            WHEN p."Marca" = '14' THEN 'GOODYEAR'
            WHEN p."Marca" = '19' THEN 'DRC / SPEEDMAX'
            ELSE 'SEM MARCA'
          END AS marca,
          p."Modelo" AS modelo,
          p."TipoPneu" AS tipo,
          p."Largura" AS medida,
          p."DataCompra" AS "dataCompra",
          p."VlCompra" AS "valorCompra",
          p."KmCompra" AS "kmCompra",
          p."Dot" AS dot,
          p."Serie" AS serie,
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
      res.status(500).json({ error: 'Erro interno ao buscar pneus', details: error.message });
    }
  }
}

module.exports = new PneuController();

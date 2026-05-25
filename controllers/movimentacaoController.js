const db = require('../config/db');

class MovimentacaoController {
  async getMovimentacoes(req, res) {
    try {
      const { rows } = await db.query(`
        SELECT
          m."CodMovPneu" AS id,
          m."Data" AS "data_movimentacao",
          COALESCE(p."NPneu", m."CodPneu") AS "id_pneu",
          COALESCE(p."NPneu", m."CodPneu") AS "numeroPneu",
          CASE m."TipoMov"
            WHEN '1' THEN 'Instalacao'
            WHEN '2' THEN 'Recapagem'
            WHEN '4' THEN 'Atualizacao'
            WHEN '5' THEN 'Baixa'
            ELSE m."TipoMov"
          END AS "tipo_movimentacao",
          CASE m."TipoMov"
            WHEN '1' THEN 'Instalacao'
            WHEN '2' THEN 'Recapagem'
            WHEN '4' THEN 'Atualizacao'
            WHEN '5' THEN 'Baixa'
            ELSE m."TipoMov"
          END AS "tipoMov",
          m."PlacaCavaloAnt" AS "veiculoAnterior",
          m."PlacaCavalo" AS "placa_veiculo",
          m."PlacaCavalo" AS "veiculoAtual",
          m."LocalAnt" AS "localAnterior",
          m."Local" AS posicao,
          m."Local" AS "localAtual",
          CASE WHEN m."TipoMov" = '1' THEN m."Km" ELSE m."KmAnt" END AS "km_entrada",
          CASE WHEN m."TipoMov" IN ('4', '5') THEN m."Km" ELSE 0 END AS "km_saida",
          m."Profundidademm" AS profundidade,
          m."MarcaRecape" AS "fornecedorRecape",
          m."TipoRecape" AS "tipoServicoRecape",
          m."VlRecape" AS "valorRecape",
          m."Obs" AS observacao
        FROM "Pneus_Mov_Frota" m
        LEFT JOIN "Pneus_Frota" p ON p."CodPneu" = m."CodPneu"
        ORDER BY m."Data" DESC NULLS LAST, m."CodMovPneu" DESC
      `);
      res.json(rows);
    } catch (error) {
      console.error('Erro ao buscar movimentacoes:', error);
      res.status(500).json({ error: 'Erro interno ao buscar movimentacoes', details: error.message });
    }
  }
}

module.exports = new MovimentacaoController();

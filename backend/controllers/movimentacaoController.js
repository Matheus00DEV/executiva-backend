const db = require('../config/db');
const { erroInterno } = require('../utils/httpResponse');

function gerarIdMov() {
  return `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function tipoMovCodigo(tipo) {
  const mapa = {
    Instalacao: '1',
    Recapagem: '2',
    Retirada: '3',
    Atualizacao: '4',
    Baixa: '5'
  };
  return mapa[tipo] || tipo || '';
}

function dataFutura(data) {
  const d = new Date(`${String(data).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return true;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return d > hoje;
}

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
            WHEN '3' THEN 'Retirada'
            WHEN '4' THEN 'Atualizacao'
            WHEN '5' THEN 'Baixa'
            ELSE m."TipoMov"
          END AS "tipo_movimentacao",
          CASE m."TipoMov"
            WHEN '1' THEN 'Instalacao'
            WHEN '2' THEN 'Recapagem'
            WHEN '3' THEN 'Retirada'
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
          CASE WHEN m."TipoMov" IN ('3', '4', '5') THEN COALESCE(NULLIF(m."Km", 0), m."KmAnt", 0) ELSE 0 END AS "km_saida",
          m."Profundidademm" AS profundidade,
          m."MarcaRecape" AS "fornecedorRecape",
          m."TipoRecape" AS "tipoServicoRecape",
          m."VlRecape" AS "valorRecape",
          m."Obs" AS observacao
        FROM "Pneus_Mov_Frota" m
        JOIN "Pneus_Frota" p ON p."CodPneu" = m."CodPneu"
        ORDER BY m."Data" DESC NULLS LAST, m."CodMovPneu" DESC
      `);
      res.json(rows);
    } catch (error) {
      console.error('Erro ao buscar movimentacoes:', error);
      return erroInterno(req, res, 'Erro interno ao buscar movimentacoes.', error);
    }
  }

  async criarMovimentacao(req, res) {
    try {
      const mov = req.body;
      const numeroPneu = String(mov.numeroPneu || mov.id_pneu || '').trim();
      const tipoMov = mov.tipo_movimentacao || mov.tipoMov || '';
      const dataMov = mov.data_movimentacao || mov.dataMov;

      if (!numeroPneu || !tipoMov || !dataMov) {
        return res.status(400).json({ error: 'Pneu, tipo e data sao obrigatorios.' });
      }
      if (dataFutura(dataMov)) {
        return res.status(400).json({ error: 'Data da movimentacao invalida ou futura.' });
      }

      const codigoTipo = tipoMovCodigo(tipoMov);
      if (!['1', '2', '3', '4', '5'].includes(codigoTipo)) {
        return res.status(400).json({ error: 'Tipo de movimentacao invalido.' });
      }

      const pneuResult = await db.query(`
        SELECT "CodPneu", "NPneu", "VeiculoAtual", "LocalAtual", "KmCompra", "Status"
        FROM "Pneus_Frota"
        WHERE "NPneu" = $1 OR "CodPneu" = $1
        LIMIT 1
      `, [numeroPneu]);

      const pneu = pneuResult.rows[0];
      if (!pneu) {
        return res.status(404).json({ error: 'Pneu nao encontrado.' });
      }

      const kmEntrada = Number(mov.km_entrada || 0) || 0;
      const kmSaida = Number(mov.km_saida || 0) || 0;
      const kmAtual = kmEntrada || kmSaida || 0;
      const veiculoAnterior = mov.veiculoAnterior || pneu.VeiculoAtual || '0';
      const localAnterior = mov.localAnterior || pneu.LocalAtual || '0';
      const veiculoAtual = mov.placa_veiculo || mov.veiculoAtual || '';
      const localAtual = mov.posicao || mov.localAtual || '';
      const profundidade = Number(mov.profundidade || 0) || null;
      const codMov = mov.id || gerarIdMov();
      const valorRecape = Number(mov.valorRecape || 0) || null;
      const fornecedorRecape = mov.fornecedorRecape || mov.marcaRecape || '';

      if (pneu.Status === 'Baixado' && codigoTipo !== '4') {
        return res.status(409).json({ error: 'Este pneu ja esta baixado e nao pode receber nova movimentacao.' });
      }
      if (profundidade !== null && (profundidade < 0 || profundidade > 40)) {
        return res.status(400).json({ error: 'Profundidade invalida.' });
      }
      if (['1', '3', '4', '5'].includes(codigoTipo) && kmAtual <= 0) {
        return res.status(400).json({ error: 'Informe o KM do veiculo para esta movimentacao.' });
      }
      if ((codigoTipo === '1' || codigoTipo === '4') && (!veiculoAtual || !localAtual)) {
        return res.status(400).json({ error: 'Veiculo e local atual sao obrigatorios.' });
      }
      if (codigoTipo === '3' && (!pneu.VeiculoAtual || pneu.VeiculoAtual === '0')) {
        return res.status(409).json({ error: 'Este pneu ja esta em estoque.' });
      }
      if (codigoTipo === '2' && (!fornecedorRecape || !valorRecape || valorRecape <= 0)) {
        return res.status(400).json({ error: 'Fornecedor e valor da recapagem/conserto sao obrigatorios.' });
      }

      const duplicada = await db.query(`
        SELECT "CodMovPneu"
        FROM "Pneus_Mov_Frota"
        WHERE "Data" = $1
          AND "CodPneu" = $2
          AND "TipoMov" = $3
          AND COALESCE("PlacaCavalo", '') = COALESCE($4, '')
          AND COALESCE("Local", '') = COALESCE($5, '')
          AND COALESCE("Km", 0) = COALESCE($6, 0)
        LIMIT 1
      `, [dataMov, pneu.CodPneu, codigoTipo, veiculoAtual, localAtual, kmAtual]);

      if (duplicada.rows.length) {
        return res.status(409).json({ error: 'Esta movimentacao parece duplicada e nao foi gravada novamente.' });
      }

      const { rows } = await db.query(`
        INSERT INTO "Pneus_Mov_Frota" (
          "CodMovPneu", "Data", "CodPneu", "PlacaCavaloAnt", "PlacaCavalo", "LocalAnt", "Local",
          "Km", "TipoMov", "MarcaRecape", "TipoRecape", "Obs", "Confirmado", "Profundidademm", "KmAnt", "VlRecape"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'S', $13, $14, $15)
        RETURNING *
      `, [
        codMov,
        dataMov,
        pneu.CodPneu,
        veiculoAnterior,
        veiculoAtual,
        localAnterior,
        localAtual,
        kmAtual,
        codigoTipo,
        fornecedorRecape,
        mov.tipoServicoRecape || '',
        mov.observacao || '',
        profundidade,
        kmSaida,
        valorRecape
      ]);

      if (codigoTipo === '1' || codigoTipo === '4') {
        await db.query(`
          UPDATE "Pneus_Frota"
          SET "VeiculoAtual" = $1, "LocalAtual" = $2, "Status" = 'Rodando',
              "Profundidademm" = COALESCE($3, "Profundidademm")
          WHERE "CodPneu" = $4
        `, [veiculoAtual || '0', localAtual || '0', profundidade, pneu.CodPneu]);
      } else if (codigoTipo === '3') {
        await db.query(`
          UPDATE "Pneus_Frota"
          SET "VeiculoAtual" = '0', "LocalAtual" = '0', "Status" = 'Estoque',
              "Profundidademm" = COALESCE($1, "Profundidademm")
          WHERE "CodPneu" = $2
        `, [profundidade, pneu.CodPneu]);
      } else if (codigoTipo === '5') {
        await db.query(`
          UPDATE "Pneus_Frota"
          SET "VeiculoAtual" = '0', "LocalAtual" = '0', "Status" = 'Baixado',
              "Profundidademm" = COALESCE($1, "Profundidademm"),
              "KmPercorrido" = CASE
                WHEN $2::double precision > COALESCE("KmCompra", 0) THEN $2::double precision - COALESCE("KmCompra", 0)
                ELSE COALESCE("KmPercorrido", 0)
              END
          WHERE "CodPneu" = $3
        `, [profundidade, kmAtual, pneu.CodPneu]);
      } else if (codigoTipo === '2') {
        await db.query(`
          UPDATE "Pneus_Frota"
          SET "Status" = 'Recapado',
              "Profundidademm" = COALESCE($1, "Profundidademm"),
              "QtdeRecapagem" = (COALESCE(NULLIF("QtdeRecapagem", ''), '0')::int + 1)::text,
              "MarcaRecap" = $2,
              "TipoRecapagem" = $3
          WHERE "CodPneu" = $4
        `, [profundidade, fornecedorRecape, mov.tipoServicoRecape || 'Recapagem', pneu.CodPneu]);
      }

      res.status(201).json({
        id: rows[0].CodMovPneu,
        data_movimentacao: dataMov,
        dataMov,
        numeroPneu: pneu.NPneu || numeroPneu,
        id_pneu: pneu.NPneu || numeroPneu,
        tipo_movimentacao: tipoMov,
        tipoMov,
        veiculoAnterior,
        localAnterior,
        placa_veiculo: veiculoAtual,
        veiculoAtual,
        posicao: localAtual,
        localAtual,
        km_entrada: codigoTipo === '1' ? kmAtual : 0,
        km_saida: ['3', '4', '5'].includes(codigoTipo) ? kmAtual : 0,
        profundidade: profundidade || 0,
        fornecedorRecape,
        tipoServicoRecape: mov.tipoServicoRecape || '',
        valorRecape: valorRecape || 0,
        observacao: mov.observacao || ''
      });
    } catch (error) {
      console.error('Erro ao criar movimentacao:', error);
      return erroInterno(req, res, 'Erro interno ao criar movimentacao.', error);
    }
  }

  async atualizarMovimentacao(req, res) {
    try {
      const codMov = String(req.params.id || '').trim();
      const mov = req.body;
      const numeroPneu = String(mov.numeroPneu || mov.id_pneu || '').trim();
      const tipoMov = mov.tipo_movimentacao || mov.tipoMov || '';
      const dataMov = mov.data_movimentacao || mov.dataMov;

      if (!codMov) {
        return res.status(400).json({ error: 'Codigo da movimentacao e obrigatorio.' });
      }
      if (!numeroPneu || !tipoMov || !dataMov) {
        return res.status(400).json({ error: 'Pneu, tipo e data sao obrigatorios.' });
      }
      if (dataFutura(dataMov)) {
        return res.status(400).json({ error: 'Data da movimentacao invalida ou futura.' });
      }

      const atualResult = await db.query(`
        SELECT "CodMovPneu"
        FROM "Pneus_Mov_Frota"
        WHERE "CodMovPneu" = $1
        LIMIT 1
      `, [codMov]);

      if (!atualResult.rows.length) {
        return res.status(404).json({ error: 'Movimentacao nao encontrada.' });
      }

      const codigoTipo = tipoMovCodigo(tipoMov);
      if (!['1', '2', '3', '4', '5'].includes(codigoTipo)) {
        return res.status(400).json({ error: 'Tipo de movimentacao invalido.' });
      }

      const pneuResult = await db.query(`
        SELECT "CodPneu", "NPneu", "VeiculoAtual", "LocalAtual", "KmCompra", "Status"
        FROM "Pneus_Frota"
        WHERE "NPneu" = $1 OR "CodPneu" = $1
        LIMIT 1
      `, [numeroPneu]);

      const pneu = pneuResult.rows[0];
      if (!pneu) {
        return res.status(404).json({ error: 'Pneu nao encontrado.' });
      }

      const kmEntrada = Number(mov.km_entrada || 0) || 0;
      const kmSaida = Number(mov.km_saida || 0) || 0;
      const kmAtual = kmEntrada || kmSaida || 0;
      const veiculoAnterior = mov.veiculoAnterior || pneu.VeiculoAtual || '0';
      const localAnterior = mov.localAnterior || pneu.LocalAtual || '0';
      const veiculoAtual = mov.placa_veiculo || mov.veiculoAtual || '';
      const localAtual = mov.posicao || mov.localAtual || '';
      const profundidade = Number(mov.profundidade || 0) || null;
      const valorRecape = Number(mov.valorRecape || 0) || null;
      const fornecedorRecape = mov.fornecedorRecape || mov.marcaRecape || '';

      if (profundidade !== null && (profundidade < 0 || profundidade > 40)) {
        return res.status(400).json({ error: 'Profundidade invalida.' });
      }
      if (['1', '3', '4', '5'].includes(codigoTipo) && kmAtual <= 0) {
        return res.status(400).json({ error: 'Informe o KM do veiculo para esta movimentacao.' });
      }
      if ((codigoTipo === '1' || codigoTipo === '4') && (!veiculoAtual || !localAtual)) {
        return res.status(400).json({ error: 'Veiculo e local atual sao obrigatorios.' });
      }
      if (codigoTipo === '2' && (!fornecedorRecape || !valorRecape || valorRecape <= 0)) {
        return res.status(400).json({ error: 'Fornecedor e valor da recapagem/conserto sao obrigatorios.' });
      }

      const { rows } = await db.query(`
        UPDATE "Pneus_Mov_Frota"
        SET "Data" = $1,
            "CodPneu" = $2,
            "PlacaCavaloAnt" = $3,
            "PlacaCavalo" = $4,
            "LocalAnt" = $5,
            "Local" = $6,
            "Km" = $7,
            "TipoMov" = $8,
            "MarcaRecape" = $9,
            "TipoRecape" = $10,
            "Obs" = $11,
            "Confirmado" = 'S',
            "Profundidademm" = $12,
            "KmAnt" = $13,
            "VlRecape" = $14
        WHERE "CodMovPneu" = $15
        RETURNING *
      `, [
        dataMov,
        pneu.CodPneu,
        veiculoAnterior,
        veiculoAtual,
        localAnterior,
        localAtual,
        kmAtual,
        codigoTipo,
        fornecedorRecape,
        mov.tipoServicoRecape || '',
        mov.observacao || '',
        profundidade,
        kmSaida,
        valorRecape,
        codMov
      ]);

      const ultimaResult = await db.query(`
        SELECT "CodMovPneu"
        FROM "Pneus_Mov_Frota"
        WHERE "CodPneu" = $1
        ORDER BY "Data" DESC NULLS LAST, "CodMovPneu" DESC
        LIMIT 1
      `, [pneu.CodPneu]);
      const atualizouUltima = ultimaResult.rows[0]?.CodMovPneu === codMov;

      if (atualizouUltima) {
        if (codigoTipo === '1' || codigoTipo === '4') {
          await db.query(`
            UPDATE "Pneus_Frota"
            SET "VeiculoAtual" = $1, "LocalAtual" = $2, "Status" = 'Rodando',
                "Profundidademm" = COALESCE($3, "Profundidademm")
            WHERE "CodPneu" = $4
          `, [veiculoAtual || '0', localAtual || '0', profundidade, pneu.CodPneu]);
        } else if (codigoTipo === '3') {
          await db.query(`
            UPDATE "Pneus_Frota"
            SET "VeiculoAtual" = '0', "LocalAtual" = '0', "Status" = 'Estoque',
                "Profundidademm" = COALESCE($1, "Profundidademm")
            WHERE "CodPneu" = $2
          `, [profundidade, pneu.CodPneu]);
        } else if (codigoTipo === '5') {
          await db.query(`
            UPDATE "Pneus_Frota"
            SET "VeiculoAtual" = '0', "LocalAtual" = '0', "Status" = 'Baixado',
                "Profundidademm" = COALESCE($1, "Profundidademm"),
                "KmPercorrido" = CASE
                  WHEN $2::double precision > COALESCE("KmCompra", 0) THEN $2::double precision - COALESCE("KmCompra", 0)
                  ELSE COALESCE("KmPercorrido", 0)
                END
            WHERE "CodPneu" = $3
          `, [profundidade, kmAtual, pneu.CodPneu]);
        } else if (codigoTipo === '2') {
          await db.query(`
            UPDATE "Pneus_Frota"
            SET "Status" = 'Recapado',
                "Profundidademm" = COALESCE($1, "Profundidademm"),
                "MarcaRecap" = $2,
                "TipoRecapagem" = $3
            WHERE "CodPneu" = $4
          `, [profundidade, fornecedorRecape, mov.tipoServicoRecape || 'Recapagem', pneu.CodPneu]);
        }
      }

      res.json({
        id: rows[0].CodMovPneu,
        data_movimentacao: dataMov,
        dataMov,
        numeroPneu: pneu.NPneu || numeroPneu,
        id_pneu: pneu.NPneu || numeroPneu,
        tipo_movimentacao: tipoMov,
        tipoMov,
        veiculoAnterior,
        localAnterior,
        placa_veiculo: veiculoAtual,
        veiculoAtual,
        posicao: localAtual,
        localAtual,
        km_entrada: codigoTipo === '1' ? kmAtual : 0,
        km_saida: ['3', '4', '5'].includes(codigoTipo) ? kmAtual : 0,
        profundidade: profundidade || 0,
        fornecedorRecape,
        tipoServicoRecape: mov.tipoServicoRecape || '',
        valorRecape: valorRecape || 0,
        observacao: mov.observacao || ''
      });
    } catch (error) {
      console.error('Erro ao atualizar movimentacao:', error);
      return erroInterno(req, res, 'Erro interno ao atualizar movimentacao.', error);
    }
  }

  async excluirMovimentacao(req, res) {
    try {
      const codMov = String(req.params.id || '').trim();
      if (!codMov) {
        return res.status(400).json({ error: 'Codigo da movimentacao e obrigatorio.' });
      }

      const { rows } = await db.query(`
        DELETE FROM "Pneus_Mov_Frota"
        WHERE "CodMovPneu" = $1
        RETURNING "CodMovPneu" AS id
      `, [codMov]);

      if (!rows.length) {
        return res.status(404).json({ error: 'Movimentacao nao encontrada.' });
      }

      res.json({ id: rows[0].id, removido: true });
    } catch (error) {
      console.error('Erro ao excluir movimentacao:', error);
      return erroInterno(req, res, 'Erro interno ao excluir movimentacao.', error);
    }
  }
}

module.exports = new MovimentacaoController();

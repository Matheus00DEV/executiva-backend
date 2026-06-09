const db = require('../config/db');
const { erroInterno } = require('../utils/httpResponse');

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function normalizarPlaca(valor) {
  return normalizarTexto(valor).toUpperCase();
}

function normalizarTipoVeiculo(valor) {
  const tipo = normalizarTexto(valor);
  const mapa = {
    '0': 'Cavalo',
    '1': 'Cavalo',
    '2': 'Carreta',
    '3': 'Reboque',
    '4': 'Bitrem',
    '5': 'Vanderleia',
    '6': 'Truck'
  };
  return mapa[tipo] || tipo || 'Cavalo';
}

function mapVeiculo(row) {
  return {
    id: row.id,
    placa: row.placa,
    marca: row.marca || '',
    modelo: row.modelo || '',
    tipo: normalizarTipoVeiculo(row.tipo),
    ano: row.ano || '',
    motorista: row.motorista || '',
    dataCadastro: row.dataCadastro || null
  };
}

function validarVeiculo(veiculo) {
  const erros = [];
  if (!normalizarPlaca(veiculo.placa)) erros.push('Placa e obrigatoria.');
  if (!normalizarTexto(veiculo.marca)) erros.push('Marca e obrigatoria.');
  if (!normalizarTexto(veiculo.modelo)) erros.push('Modelo e obrigatorio.');
  if (!normalizarTexto(veiculo.tipo)) erros.push('Tipo e obrigatorio.');
  return erros;
}

class VeiculoController {
  async getVeiculos(req, res) {
    try {
      const { rows } = await db.query(`
        SELECT
          COALESCE("CodCavalo", "PlacaCavalo") AS id,
          "PlacaCavalo" AS placa,
          COALESCE("MarcaCavalo", "Marca") AS marca,
          COALESCE("ModeloCavalo", "Modelo") AS modelo,
          COALESCE("TipoCavalo", "TipoEquip", 'Cavalo') AS tipo,
          COALESCE("AnoCavalo", "Ano") AS ano,
          COALESCE("NomeMot", '') AS motorista,
          "DataAquisicao" AS "dataCadastro"
        FROM "Cavalo"
        WHERE NULLIF(TRIM("PlacaCavalo"), '') IS NOT NULL
          AND (
            NULLIF(TRIM(COALESCE("TipoCavalo", '')), '') IS NULL
            OR TRIM("TipoCavalo") IN ('2', '3', '4', '6')
            OR UPPER(TRIM("TipoCavalo")) = 'CAVALO'
          )
        ORDER BY "PlacaCavalo" ASC
      `);
      res.json(rows.map(mapVeiculo));
    } catch (error) {
      console.error('Erro ao buscar veiculos:', error);
      return erroInterno(req, res, 'Erro interno ao buscar veiculos.', error);
    }
  }

  async criarVeiculo(req, res) {
    try {
      const erros = validarVeiculo(req.body);
      if (erros.length) return res.status(400).json({ error: erros.join(' ') });

      const placa = normalizarPlaca(req.body.placa);
      const codCavalo = normalizarTexto(req.body.id) || placa;
      const marca = normalizarTexto(req.body.marca);
      const modelo = normalizarTexto(req.body.modelo);
      const tipo = normalizarTexto(req.body.tipo);
      const ano = normalizarTexto(req.body.ano);
      const motorista = normalizarTexto(req.body.motorista);

      const duplicado = await db.query(`
        SELECT "CodCavalo", "PlacaCavalo"
        FROM "Cavalo"
        WHERE UPPER(TRIM("CodCavalo")) = UPPER(TRIM($1))
           OR UPPER(TRIM("PlacaCavalo")) = UPPER(TRIM($2))
        LIMIT 1
      `, [codCavalo, placa]);

      if (duplicado.rows.length) {
        return res.status(409).json({ error: 'Ja existe um veiculo com este codigo ou placa.' });
      }

      const { rows } = await db.query(`
        INSERT INTO "Cavalo" (
          "CodCavalo", "PlacaCavalo", "MarcaCavalo", "ModeloCavalo", "TipoCavalo",
          "AnoCavalo", "NomeMot", "DataAquisicao", "Marca", "Modelo", "Placa", "Ano", "TipoEquip"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $3, $4, $2, $6, $5)
        RETURNING
          "CodCavalo" AS id,
          "PlacaCavalo" AS placa,
          COALESCE("MarcaCavalo", "Marca") AS marca,
          COALESCE("ModeloCavalo", "Modelo") AS modelo,
          COALESCE("TipoCavalo", "TipoEquip", 'Cavalo') AS tipo,
          COALESCE("AnoCavalo", "Ano") AS ano,
          COALESCE("NomeMot", '') AS motorista,
          "DataAquisicao" AS "dataCadastro"
      `, [codCavalo, placa, marca, modelo, tipo, ano, motorista]);

      res.status(201).json(mapVeiculo(rows[0]));
    } catch (error) {
      console.error('Erro ao criar veiculo:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ja existe um veiculo com este codigo.' });
      }
      return erroInterno(req, res, 'Erro interno ao criar veiculo.', error);
    }
  }

  async atualizarVeiculo(req, res) {
    try {
      const id = normalizarTexto(req.params.id);
      if (!id) return res.status(400).json({ error: 'Codigo do veiculo e obrigatorio.' });

      const erros = validarVeiculo(req.body);
      if (erros.length) return res.status(400).json({ error: erros.join(' ') });

      const atualResult = await db.query(`
        SELECT "CodCavalo", "PlacaCavalo"
        FROM "Cavalo"
        WHERE "CodCavalo" = $1
        LIMIT 1
      `, [id]);

      if (!atualResult.rows.length) {
        return res.status(404).json({ error: 'Veiculo nao encontrado.' });
      }

      const placaAnterior = atualResult.rows[0].PlacaCavalo;
      const placa = normalizarPlaca(req.body.placa);
      const marca = normalizarTexto(req.body.marca);
      const modelo = normalizarTexto(req.body.modelo);
      const tipo = normalizarTexto(req.body.tipo);
      const ano = normalizarTexto(req.body.ano);
      const motorista = normalizarTexto(req.body.motorista);

      const duplicado = await db.query(`
        SELECT "CodCavalo"
        FROM "Cavalo"
        WHERE UPPER(TRIM("PlacaCavalo")) = UPPER(TRIM($1))
          AND "CodCavalo" <> $2
        LIMIT 1
      `, [placa, id]);

      if (duplicado.rows.length) {
        return res.status(409).json({ error: 'Ja existe outro veiculo com esta placa.' });
      }

      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(`
          UPDATE "Cavalo"
          SET "PlacaCavalo" = $1,
              "MarcaCavalo" = $2,
              "ModeloCavalo" = $3,
              "TipoCavalo" = $4,
              "AnoCavalo" = $5,
              "NomeMot" = $6,
              "Marca" = $2,
              "Modelo" = $3,
              "Placa" = $1,
              "Ano" = $5,
              "TipoEquip" = $4
          WHERE "CodCavalo" = $7
          RETURNING
            "CodCavalo" AS id,
            "PlacaCavalo" AS placa,
            COALESCE("MarcaCavalo", "Marca") AS marca,
            COALESCE("ModeloCavalo", "Modelo") AS modelo,
            COALESCE("TipoCavalo", "TipoEquip", 'Cavalo') AS tipo,
            COALESCE("AnoCavalo", "Ano") AS ano,
            COALESCE("NomeMot", '') AS motorista,
            "DataAquisicao" AS "dataCadastro"
        `, [placa, marca, modelo, tipo, ano, motorista, id]);

        if (placaAnterior && normalizarPlaca(placaAnterior) !== placa) {
          await client.query(`
            UPDATE "Pneus_Frota"
            SET "VeiculoAtual" = $1
            WHERE UPPER(TRIM("VeiculoAtual")) = UPPER(TRIM($2))
          `, [placa, placaAnterior]);

          await client.query(`
            UPDATE "Pneus_Mov_Frota"
            SET "PlacaCavalo" = CASE WHEN UPPER(TRIM("PlacaCavalo")) = UPPER(TRIM($2)) THEN $1 ELSE "PlacaCavalo" END,
                "PlacaCavaloAnt" = CASE WHEN UPPER(TRIM("PlacaCavaloAnt")) = UPPER(TRIM($2)) THEN $1 ELSE "PlacaCavaloAnt" END
            WHERE UPPER(TRIM(COALESCE("PlacaCavalo", ''))) = UPPER(TRIM($2))
               OR UPPER(TRIM(COALESCE("PlacaCavaloAnt", ''))) = UPPER(TRIM($2))
          `, [placa, placaAnterior]);
        }

        await client.query('COMMIT');
        res.json(mapVeiculo(rows[0]));
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erro ao atualizar veiculo:', error);
      return erroInterno(req, res, 'Erro interno ao atualizar veiculo.', error);
    }
  }

  async excluirVeiculo(req, res) {
    try {
      const id = normalizarTexto(req.params.id);
      if (!id) return res.status(400).json({ error: 'Codigo do veiculo e obrigatorio.' });

      const atualResult = await db.query(`
        SELECT "CodCavalo", "PlacaCavalo"
        FROM "Cavalo"
        WHERE "CodCavalo" = $1
        LIMIT 1
      `, [id]);

      if (!atualResult.rows.length) {
        return res.status(404).json({ error: 'Veiculo nao encontrado.' });
      }

      const placa = atualResult.rows[0].PlacaCavalo;
      const vinculados = await db.query(`
        SELECT COUNT(*)::int AS total
        FROM "Pneus_Frota"
        WHERE UPPER(TRIM(COALESCE("VeiculoAtual", ''))) = UPPER(TRIM($1))
      `, [placa]);

      if (vinculados.rows[0].total > 0) {
        return res.status(409).json({ error: 'Este veiculo possui pneus vinculados. Retire os pneus antes de excluir.' });
      }

      await db.query('DELETE FROM "Cavalo" WHERE "CodCavalo" = $1', [id]);
      res.json({ message: 'Veiculo excluido com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir veiculo:', error);
      return erroInterno(req, res, 'Erro interno ao excluir veiculo.', error);
    }
  }
}

module.exports = new VeiculoController();

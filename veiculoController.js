const db = require('../config/db');

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
        WHERE "PlacaCavalo" IS NOT NULL
        ORDER BY "PlacaCavalo" ASC
      `);
      res.json(rows);
    } catch (error) {
      console.error('Erro ao buscar veiculos:', error);
      res.status(500).json({ error: 'Erro interno ao buscar veiculos', details: error.message });
    }
  }
}

module.exports = new VeiculoController();


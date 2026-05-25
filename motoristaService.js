const db = require('../config/db');

class MotoristaService {
  mapRow(row) {
    let dataValidade = null;
    if (row.DataCNHMotVenc) {
      const dateObj = new Date(row.DataCNHMotVenc);
      dataValidade = dateObj.toISOString().split('T')[0];
    }

    return {
      nome: row.NomeMot || null,
      cpf: row.CPFMot || null,
      cnh: row.NCNHMot || null,
      celular: row.CelularMot || null,
      tipoCNH: row.TipoCNHMot || null,
      validadeCNH: dataValidade,
      observacao: row.ObsMot || null
    };
  }

  async listarTodos() {
    const { rows } = await db.query(`
      SELECT
        "NomeMot",
        "CPFMot",
        "NCNHMot",
        "CelularMot",
        "TipoCNHMot",
        "DataCNHMotVenc",
        "ObsMot"
      FROM "Motorista"
      ORDER BY "NomeMot" ASC
    `);

    return rows.map(row => this.mapRow(row));
  }

  async criar(motorista) {
    const { nome, cpf, cnh, celular, tipoCNH, validadeCNH, observacao } = motorista;
    const { rows } = await db.query(`
      INSERT INTO "Motorista" ("NomeMot", "CPFMot", "NCNHMot", "CelularMot", "TipoCNHMot", "DataCNHMotVenc", "ObsMot")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING "NomeMot", "CPFMot", "NCNHMot", "CelularMot", "TipoCNHMot", "DataCNHMotVenc", "ObsMot"
    `, [nome, cpf, cnh, celular, tipoCNH, validadeCNH || null, observacao]);

    return this.mapRow(rows[0]);
  }

  async atualizar(cpf, motorista) {
    const { nome, cnh, celular, tipoCNH, validadeCNH, observacao } = motorista;
    const { rows } = await db.query(`
      UPDATE "Motorista"
      SET "NomeMot" = $1, "NCNHMot" = $2, "CelularMot" = $3, "TipoCNHMot" = $4, "DataCNHMotVenc" = $5, "ObsMot" = $6
      WHERE "CPFMot" = $7
      RETURNING "NomeMot", "CPFMot", "NCNHMot", "CelularMot", "TipoCNHMot", "DataCNHMotVenc", "ObsMot"
    `, [nome, cnh, celular, tipoCNH, validadeCNH || null, observacao, cpf]);

    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async excluir(cpf) {
    await db.query(`
      DELETE FROM "Motorista"
      WHERE "CPFMot" = $1
    `, [cpf]);
    return true;
  }
}

module.exports = new MotoristaService();


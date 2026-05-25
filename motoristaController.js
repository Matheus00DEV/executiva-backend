const motoristaService = require('../services/motoristaService');

class MotoristaController {
  async getMotoristas(req, res) {
    try {
      const motoristas = await motoristaService.listarTodos();
      res.json(motoristas);
    } catch (error) {
      console.error('Erro ao buscar motoristas:', error);
      res.status(500).json({ error: 'Erro interno ao buscar motoristas', details: error.message });
    }
  }

  async criarMotorista(req, res) {
    try {
      const motorista = await motoristaService.criar(req.body);
      res.status(201).json(motorista);
    } catch (error) {
      console.error('Erro ao criar motorista:', error);
      res.status(500).json({ error: 'Erro interno ao criar motorista', details: error.message });
    }
  }

  async atualizarMotorista(req, res) {
    try {
      const { cpf } = req.params;
      const motorista = await motoristaService.atualizar(cpf, req.body);
      res.json(motorista);
    } catch (error) {
      console.error('Erro ao atualizar motorista:', error);
      res.status(500).json({ error: 'Erro interno ao atualizar motorista', details: error.message });
    }
  }

  async excluirMotorista(req, res) {
    try {
      const { cpf } = req.params;
      await motoristaService.excluir(cpf);
      res.json({ message: 'Motorista excluído com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir motorista:', error);
      res.status(500).json({ error: 'Erro interno ao excluir motorista', details: error.message });
    }
  }
}

module.exports = new MotoristaController();

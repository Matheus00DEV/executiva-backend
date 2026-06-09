const motoristaService = require('../services/motoristaService');
const { erroInterno } = require('../utils/httpResponse');

class MotoristaController {
  async getMotoristas(req, res) {
    try {
      const motoristas = await motoristaService.listarTodos();
      res.json(motoristas);
    } catch (error) {
      console.error('Erro ao buscar motoristas:', error);
      return erroInterno(req, res, 'Erro interno ao buscar motoristas.', error);
    }
  }

  async criarMotorista(req, res) {
    try {
      const motorista = await motoristaService.criar(req.body);
      res.status(201).json(motorista);
    } catch (error) {
      console.error('Erro ao criar motorista:', error);
      return erroInterno(req, res, 'Erro interno ao criar motorista.', error);
    }
  }

  async atualizarMotorista(req, res) {
    try {
      const { cpf } = req.params;
      const motorista = await motoristaService.atualizar(cpf, req.body);
      if (!motorista) return res.status(404).json({ error: 'Motorista nao encontrado.', requestId: req.id });
      res.json(motorista);
    } catch (error) {
      console.error('Erro ao atualizar motorista:', error);
      return erroInterno(req, res, 'Erro interno ao atualizar motorista.', error);
    }
  }

  async excluirMotorista(req, res) {
    try {
      const { cpf } = req.params;
      const excluido = await motoristaService.excluir(cpf);
      if (!excluido) return res.status(404).json({ error: 'Motorista nao encontrado.', requestId: req.id });
      res.json({ message: 'Motorista excluído com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir motorista:', error);
      return erroInterno(req, res, 'Erro interno ao excluir motorista.', error);
    }
  }
}

module.exports = new MotoristaController();

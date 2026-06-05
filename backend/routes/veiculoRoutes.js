const express = require('express');
const router = express.Router();
const veiculoController = require('../controllers/veiculoController');
const { exigirAutenticacao, exigirPermissaoCadastro } = require('../middleware/authMiddleware');

router.use(exigirAutenticacao);
router.get('/', veiculoController.getVeiculos);
router.post('/', exigirPermissaoCadastro, veiculoController.criarVeiculo);
router.put('/:id', exigirPermissaoCadastro, veiculoController.atualizarVeiculo);
router.delete('/:id', exigirPermissaoCadastro, veiculoController.excluirVeiculo);

module.exports = router;

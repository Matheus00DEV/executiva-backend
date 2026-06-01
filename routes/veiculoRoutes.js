const express = require('express');
const router = express.Router();
const veiculoController = require('../controllers/veiculoController');

router.get('/', veiculoController.getVeiculos);
router.post('/', veiculoController.criarVeiculo);
router.put('/:id', veiculoController.atualizarVeiculo);
router.delete('/:id', veiculoController.excluirVeiculo);

module.exports = router;

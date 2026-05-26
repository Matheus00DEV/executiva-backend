const express = require('express');
const router = express.Router();
const movimentacaoController = require('../controllers/movimentacaoController');

router.get('/', movimentacaoController.getMovimentacoes);
router.post('/', movimentacaoController.criarMovimentacao);
router.put('/:id', movimentacaoController.atualizarMovimentacao);

module.exports = router;

const express = require('express');
const router = express.Router();
const movimentacaoController = require('../controllers/movimentacaoController');
const { exigirAutenticacao, exigirPermissaoCadastro } = require('../middleware/authMiddleware');

router.use(exigirAutenticacao);
router.get('/', movimentacaoController.getMovimentacoes);
router.post('/', exigirPermissaoCadastro, movimentacaoController.criarMovimentacao);
router.put('/:id', exigirPermissaoCadastro, movimentacaoController.atualizarMovimentacao);
router.delete('/:id', exigirPermissaoCadastro, movimentacaoController.excluirMovimentacao);

module.exports = router;

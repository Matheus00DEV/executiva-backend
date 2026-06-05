const express = require('express');
const router = express.Router();
const motoristaController = require('../controllers/motoristaController');
const { exigirAutenticacao, exigirPermissaoCadastro } = require('../middleware/authMiddleware');

router.use(exigirAutenticacao);
router.get('/', motoristaController.getMotoristas);
router.post('/', exigirPermissaoCadastro, motoristaController.criarMotorista);
router.put('/:cpf', exigirPermissaoCadastro, motoristaController.atualizarMotorista);
router.delete('/:cpf', exigirPermissaoCadastro, motoristaController.excluirMotorista);

module.exports = router;

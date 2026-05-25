const express = require('express');
const router = express.Router();
const motoristaController = require('../controllers/motoristaController');

router.get('/', motoristaController.getMotoristas);
router.post('/', motoristaController.criarMotorista);
router.put('/:cpf', motoristaController.atualizarMotorista);
router.delete('/:cpf', motoristaController.excluirMotorista);

module.exports = router;

const express = require('express');
const router = express.Router();
const pneuController = require('../controllers/pneuController');

router.get('/', pneuController.getPneus);
router.post('/', pneuController.criarPneu);

module.exports = router;

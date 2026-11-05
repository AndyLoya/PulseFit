const express = require('express');
const controller = require('../controllers/nutrition.controller');
const { authenticateJwt } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/search', controller.searchFoods);
router.get('/macro-breakdown/:foodId', controller.macroBreakdown);
router.post('/logs', authenticateJwt, controller.logFood);

module.exports = router;

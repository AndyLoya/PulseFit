const express = require('express');
const nutrition = require('../controllers/nutrition.controller');

const router = express.Router();

router.get('/search', nutrition.searchFoods);
router.get('/macro-breakdown/:foodId', nutrition.macroBreakdown);
router.post('/logs', nutrition.createLog);

module.exports = router;

const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../controllers/auth.controller');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const router = express.Router();
router.use(authLimiter);
router.post('/login', auth.login);
router.post('/refresh', auth.refresh);

module.exports = router;

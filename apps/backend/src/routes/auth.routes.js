const express = require('express');
const auth = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', auth.login);
router.post('/refresh', auth.refresh);

module.exports = router;

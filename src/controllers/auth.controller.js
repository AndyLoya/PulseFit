const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const sign = (payload, expiresIn) => jwt.sign(payload, process.env.JWT_SECRET, {
  algorithm: 'HS256',
  expiresIn
});

exports.login = async (req, res) => {
  if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'Internal server error' });
  const { username, password } = req.body || {};
  const passwordHash = process.env.DEMO_USER_PASSWORD_HASH || process.env.DEMO_PASSWORD_HASH;
  const validUser = username === (process.env.DEMO_USERNAME || 'pulsefit-demo');
  const validPassword = typeof password === 'string' && passwordHash && await bcrypt.compare(password, passwordHash);

  if (!validUser || !validPassword) {
    return res.status(401).json({ error: 'Unauthorized', details: ['Invalid username or password'] });
  }

  res.json({
    accessToken: sign({ sub: username, type: 'access' }, process.env.ACCESS_TOKEN_TTL || '15m'),
    refreshToken: sign({ sub: username, type: 'refresh' }, process.env.REFRESH_TOKEN_TTL || '7d'),
    tokenType: 'Bearer',
    expiresIn: process.env.ACCESS_TOKEN_TTL || '15m'
  });
};

exports.refresh = (req, res) => {
  const refreshToken = req.body?.refreshToken;
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.type !== 'refresh') throw new Error('Wrong token type');
    res.json({
      accessToken: sign({ sub: payload.sub, type: 'access' }, process.env.ACCESS_TOKEN_TTL || '15m'),
      tokenType: 'Bearer',
      expiresIn: process.env.ACCESS_TOKEN_TTL || '15m'
    });
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized', details: ['Refresh token is missing, invalid, or expired'] });
  }
};

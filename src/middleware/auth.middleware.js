const jwt = require('jsonwebtoken');

function authenticateJwt(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error('Server authentication is not configured');
    error.status = 500;
    return next(error);
  }

  const authorization = req.get('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', details: ['A Bearer token is required'] });
  }

  const token = authorization.slice(7).trim();
  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized', details: ['Token is missing, invalid, or expired'] });
  }
}

module.exports = { authenticateJwt };

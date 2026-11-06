require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const nutritionRoutes = require('./src/routes/nutrition.routes');
const authRoutes = require('./src/routes/auth.routes');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8080')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => {
  res.json({ service: 'PulseFit Backend', status: 'ok' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/v1/nutrition', nutritionRoutes);
app.use('/api/v1/auth', authRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid input',
      details: ['Request body must be valid JSON']
    });
  }

  if (err.status === 502) {
    return res.status(502).json({ error: 'Nutrition service unavailable' });
  }

  console.error('Unhandled backend error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3001);
  app.listen(port, () => console.log(`PulseFit Backend listening on port ${port}`));
}

module.exports = app;

require('dotenv').config();

const express = require('express');
const nutritionRoutes = require('./src/routes/nutrition.routes');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.get('/', (req, res) => {
  res.json({
    service: 'PulseFit Nutrition',
    status: 'ok',
    baseUrl: '/api/v1/nutrition'
  });
});
app.use('/api/v1/nutrition', nutritionRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid input', details: ['Request body must be valid JSON'] });
  }

  console.error('Unhandled application error:', err);
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message || 'Request failed' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`PulseFit Nutrition service listening on port ${port}`));
}

module.exports = app;

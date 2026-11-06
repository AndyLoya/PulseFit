const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

process.env.JWT_SECRET = 'integration-test-secret-for-pulsefit';
process.env.DEMO_USERNAME = 'integration-user';
process.env.DEMO_PASSWORD_HASH = '$2b$04$j4593RCy5nYMtXrXU4YROO/D3BLlcLWHnsqmj3mAZPBC4Zb2MJGOG';

const nutritionApp = require('../../nutrition-api/server');
const backendApp = require('../server');

let providerServer;
let nutritionServer;
let backendServer;
let backendUrl;

async function start(app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function close(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

test.before(async () => {
  const provider = express();
  provider.get('/cgi/search.pl', (req, res) => {
    res.json({
      products: [{
        code: 'e2e-food',
        product_name: 'Integration orange',
        brands: 'PulseFit Test'
      }]
    });
  });
  provider.get('/api/v2/product/:foodId', (req, res) => {
    res.json({
      product: {
        product_name: 'Integration orange',
        nutriments: {
          'energy-kcal_100g': 50,
          proteins_100g: 2,
          carbohydrates_100g: 12,
          fat_100g: 0.2
        }
      }
    });
  });

  const providerInstance = await start(provider);
  providerServer = providerInstance.server;
  process.env.OPEN_FOOD_FACTS_BASE_URL = providerInstance.url;

  const nutritionInstance = await start(nutritionApp);
  nutritionServer = nutritionInstance.server;
  process.env.NUTRITION_API_BASE_URL = `${nutritionInstance.url}/api/v1`;

  const backendInstance = await start(backendApp);
  backendServer = backendInstance.server;
  backendUrl = backendInstance.url;
});

test.after(async () => {
  await close(backendServer);
  await close(nutritionServer);
  await close(providerServer);
});

test('frontend-facing backend completes nutrition and authentication flows through the microservice', async () => {
  const search = await fetch(`${backendUrl}/api/v1/nutrition/search?query=orange`);
  assert.equal(search.status, 200);
  assert.equal((await search.json()).products[0].name, 'Integration orange');

  const breakdown = await fetch(
    `${backendUrl}/api/v1/nutrition/macro-breakdown/e2e-food?quantityGrams=200`
  );
  assert.equal(breakdown.status, 200);
  assert.deepEqual((await breakdown.json()).macros, {
    calories: 100,
    proteinG: 4,
    carbsG: 24,
    fatG: 0.4
  });

  const unauthorized = await fetch(`${backendUrl}/api/v1/nutrition/logs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ foodId: 'e2e-food', quantityGrams: 200, mealType: 'snack' })
  });
  assert.equal(unauthorized.status, 401);

  const login = await fetch(`${backendUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'integration-user', password: 'integration-password' })
  });
  assert.equal(login.status, 200);
  const { accessToken } = await login.json();

  const log = await fetch(`${backendUrl}/api/v1/nutrition/logs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ foodId: 'e2e-food', quantityGrams: 200, mealType: 'snack' })
  });
  assert.equal(log.status, 201);
  assert.equal((await log.json()).log.foodId, 'e2e-food');
});

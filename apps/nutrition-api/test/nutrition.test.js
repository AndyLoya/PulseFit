const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-only-secret-for-pulsefit-nutrition-api';
process.env.DEMO_USERNAME = 'pulsefit-demo';
process.env.DEMO_PASSWORD_HASH = bcrypt.hashSync('pulsefit-demo-password', 4);

const app = require('../server');

let providerServer;

async function start(appToStart) {
  const server = appToStart.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

async function withServer(run) {
  const { server, baseUrl } = await start(app);
  try {
    return await run(baseUrl);
  } finally {
    await close(server);
  }
}

test.before(async () => {
  const provider = express();
  provider.get('/cgi/search.pl', (req, res) => {
    res.json({
      products: [{
        code: '3017620422003',
        product_name: 'Test chocolate spread',
        brands: 'Test brand',
        image_front_small_url: 'https://example.test/food.jpg'
      }]
    });
  });
  provider.get('/api/v2/product/:foodId', (req, res) => {
    if (req.params.foodId !== '3017620422003') {
      return res.status(404).json({ product: null });
    }

    res.json({
      product: {
        product_name: 'Test chocolate spread',
        brands: 'Test brand',
        nutriments: {
          'energy-kcal_100g': 200,
          proteins_100g: 10,
          carbohydrates_100g: 20,
          fat_100g: 5
        }
      }
    });
  });

  const providerInstance = await start(provider);
  providerServer = providerInstance.server;
  process.env.OPEN_FOOD_FACTS_BASE_URL = providerInstance.baseUrl;
});

test.after(async () => {
  await close(providerServer);
});

test('search returns products from the configured food provider', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/v1/nutrition/search?query=chocolate`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.query, 'chocolate');
    assert.equal(body.count, 1);
    assert.equal(body.products[0].foodId, '3017620422003');
    assert.equal(body.fallback, false);
  });
});

test('invalid search input returns a structured 400', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/v1/nutrition/search?query=`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, 'Invalid input');
    assert.ok(Array.isArray(body.details));
  });
});

test('macro breakdown calculates nutrients for the requested serving size', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/v1/nutrition/macro-breakdown/3017620422003?quantityGrams=150`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      foodId: '3017620422003',
      name: 'Test chocolate spread',
      quantityGrams: 150,
      unit: 'g',
      macros: { calories: 300, proteinG: 15, carbsG: 30, fatG: 7.5 }
    });
  });
});

test('macro breakdown returns 404 for an unknown food', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/v1/nutrition/macro-breakdown/unknown`);
    assert.equal(response.status, 404);
    assert.deepEqual((await response.json()).error, 'Food not found');
  });
});

test('protected log rejects missing and tampered credentials', async () => {
  await withServer(async baseUrl => {
    const url = `${baseUrl}/api/v1/nutrition/logs`;
    const options = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    };
    assert.equal((await fetch(url, options)).status, 401);

    const tampered = `${jwt.sign({ sub: 'demo', type: 'access' }, process.env.JWT_SECRET)}tamper`;
    const response = await fetch(url, {
      ...options,
      headers: { ...options.headers, authorization: `Bearer ${tampered}` }
    });
    assert.equal(response.status, 401);
  });
});

test('login, refresh, and authenticated log complete successfully', async () => {
  await withServer(async baseUrl => {
    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'pulsefit-demo', password: 'pulsefit-demo-password' })
    });
    assert.equal(loginResponse.status, 200);
    const tokens = await loginResponse.json();
    assert.ok(tokens.accessToken);
    assert.ok(tokens.refreshToken);

    const refreshResponse = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken })
    });
    assert.equal(refreshResponse.status, 200);
    assert.ok((await refreshResponse.json()).accessToken);

    const response = await fetch(`${baseUrl}/api/v1/nutrition/logs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${tokens.accessToken}`
      },
      body: JSON.stringify({ foodId: '3017620422003', quantityGrams: 150, mealType: 'snack' })
    });
    assert.equal(response.status, 201);
  });
});

test('invalid nutrition log returns a structured 400', async () => {
  await withServer(async baseUrl => {
    const token = jwt.sign(
      { sub: 'test', type: 'access' },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '15m' }
    );
    const response = await fetch(`${baseUrl}/api/v1/nutrition/logs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ foodId: '3017620422003', quantityGrams: -1, mealType: 'midnight' })
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Invalid input');
  });
});

test('malformed JSON returns a clear 400 without internal details', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/v1/nutrition/logs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"foodId":'
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Invalid input',
      details: ['Request body must be valid JSON']
    });
  });
});

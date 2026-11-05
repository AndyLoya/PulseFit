const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../server');

async function withServer(run) {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try { return await run(baseUrl); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('search returns JSON fallback or results', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/v1/nutrition/search?query=banana`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.query, 'banana');
    assert.equal(typeof body.fallback, 'boolean');
  });
});

test('invalid search input returns structured 400', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/v1/nutrition/search?query=`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, 'Invalid input');
    assert.ok(Array.isArray(body.details));
  });
});

test('macro breakdown has a JSON success or not-found response', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/v1/nutrition/macro-breakdown/3017620422003?quantityGrams=150`);
    assert.ok([200, 404].includes(response.status));
    assert.equal(response.headers.get('content-type').includes('application/json'), true);
  });
});

test('protected log rejects missing and tampered credentials', async () => {
  await withServer(async baseUrl => {
    const url = `${baseUrl}/api/v1/nutrition/logs`;
    const options = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' };
    assert.equal((await fetch(url, options)).status, 401);

    const tampered = `${jwt.sign({ sub: 'demo', type: 'access' }, process.env.JWT_SECRET)}tamper`;
    const response = await fetch(url, { ...options, headers: { ...options.headers, authorization: `Bearer ${tampered}` } });
    assert.equal(response.status, 401);
  });
});

test('login and authenticated log return success', async () => {
  await withServer(async baseUrl => {
    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: process.env.DEMO_USERNAME, password: 'pulsefit-demo-password' })
    });
    assert.equal(loginResponse.status, 200);
    const tokens = await loginResponse.json();

    const response = await fetch(`${baseUrl}/api/v1/nutrition/logs`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.accessToken}` },
      body: JSON.stringify({ foodId: '3017620422003', quantityGrams: 150, mealType: 'snack' })
    });
    assert.equal(response.status, 201);
  });
});

test('invalid nutrition log returns structured 400', async () => {
  await withServer(async baseUrl => {
    const token = jwt.sign({ sub: 'test', type: 'access' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
    const response = await fetch(`${baseUrl}/api/v1/nutrition/logs`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ foodId: '3017620422003', quantityGrams: -1, mealType: 'midnight' })
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, 'Invalid input');
  });
});

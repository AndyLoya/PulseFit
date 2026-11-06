const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const app = require('../server');

let upstreamServer;
let upstreamBaseUrl;
let requests;

async function start(app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function close(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

async function withBackend(run) {
  const { server, baseUrl } = await start(app);
  try {
    return await run(baseUrl);
  } finally {
    await close(server);
  }
}

test.before(async () => {
  const mock = express();
  mock.use(express.json());
  requests = [];
  mock.use((req, res) => {
    requests.push({
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      authorization: req.get('authorization')
    });

    if (req.path === '/api/v1/nutrition/search') {
      if (req.query.query === 'upstream-error') {
        return res.status(500).json({ error: 'Internal error', stack: 'private upstream detail' });
      }
      if (!req.query.query) {
        return res.status(400).json({ error: 'Invalid input', details: ['query is required'] });
      }
      return res.json({ query: req.query.query, products: [] });
    }

    if (req.path.startsWith('/api/v1/nutrition/macro-breakdown/')) {
      return res.json({ foodId: req.path.split('/').pop(), macros: { calories: 100 } });
    }

    if (req.path === '/api/v1/nutrition/logs') {
      if (!req.get('authorization')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      return res.status(201).json({ message: 'Food log created', log: req.body });
    }

    if (req.path === '/api/v1/auth/login') {
      return res.json({ accessToken: 'test-access-token' });
    }

    if (req.path === '/api/v1/auth/refresh') {
      return res.json({ accessToken: 'refreshed-access-token' });
    }

    res.status(404).json({ error: 'Not found' });
  });

  const upstream = await start(mock);
  upstreamServer = upstream.server;
  upstreamBaseUrl = upstream.baseUrl;
  process.env.NUTRITION_API_BASE_URL = `${upstreamBaseUrl}/api/v1`;
});

test.after(async () => {
  await close(upstreamServer);
});

test('health endpoint responds without depending on the nutrition service', async () => {
  await withBackend(async baseUrl => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('search and macro endpoints are forwarded to the nutrition microservice', async () => {
  await withBackend(async baseUrl => {
    const search = await fetch(`${baseUrl}/api/v1/nutrition/search?query=banana&page=2&pageSize=10`);
    assert.equal(search.status, 200);
    assert.deepEqual(await search.json(), { query: 'banana', products: [] });
    assert.deepEqual(requests.at(-1).query, { query: 'banana', page: '2', pageSize: '10' });

    const macros = await fetch(`${baseUrl}/api/v1/nutrition/macro-breakdown/food%201?quantityGrams=150`);
    assert.equal(macros.status, 200);
    assert.deepEqual(await macros.json(), { foodId: 'food%201', macros: { calories: 100 } });
    assert.equal(requests.at(-1).query.quantityGrams, '150');
  });
});

test('backend forwards authentication and protected food logs', async () => {
  await withBackend(async baseUrl => {
    const unauthenticated = await fetch(`${baseUrl}/api/v1/nutrition/logs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ foodId: '123', quantityGrams: 100, mealType: 'snack' })
    });
    assert.equal(unauthenticated.status, 401);

    const authorization = 'Bearer test-access-token';
    const created = await fetch(`${baseUrl}/api/v1/nutrition/logs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify({ foodId: '123', quantityGrams: 100, mealType: 'snack' })
    });
    assert.equal(created.status, 201);
    assert.equal(requests.at(-1).authorization, authorization);
    assert.deepEqual((await created.json()).log, {
      foodId: '123',
      quantityGrams: 100,
      mealType: 'snack'
    });
  });
});

test('auth routes forward login and refresh requests', async () => {
  await withBackend(async baseUrl => {
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'demo', password: 'pass' })
    });
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), { accessToken: 'test-access-token' });

    const refresh = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'test-refresh-token' })
    });
    assert.equal(refresh.status, 200);
    assert.deepEqual(await refresh.json(), { accessToken: 'refreshed-access-token' });
  });
});

test('validation errors from the microservice retain their status and JSON body', async () => {
  await withBackend(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/v1/nutrition/search`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Invalid input',
      details: ['query is required']
    });
  });
});

test('invalid JSON is rejected by the backend with a clear 400 response', async () => {
  await withBackend(async baseUrl => {
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

test('nutrition service connection errors do not expose internal details', async () => {
  await withBackend(async baseUrl => {
    process.env.NUTRITION_API_BASE_URL = 'http://127.0.0.1:1/api/v1';
    const response = await fetch(`${baseUrl}/api/v1/nutrition/search?query=banana`);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'Nutrition service unavailable' });
  });
});

test('upstream server errors are sanitized before reaching the client', async () => {
  await withBackend(async baseUrl => {
    process.env.NUTRITION_API_BASE_URL = `${upstreamBaseUrl}/api/v1`;
    const response = await fetch(`${baseUrl}/api/v1/nutrition/search?query=upstream-error`);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'Nutrition service unavailable' });
  });
});

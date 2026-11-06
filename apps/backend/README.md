# PulseFit Application Backend

This Express API is the application-facing backend. Its nutrition module calls the separate PulseFit Nutrition microservice from `src/services/nutrition-api.client.js`; the frontend should call this backend rather than calling the microservice directly.

## Setup

1. Install Node.js 18 or newer.
2. From the repository root, install all workspace dependencies:
   ```sh
   npm install
   ```
3. Configure the nutrition microservice as described in [its README](../nutrition-api/README.md), then start it:
   ```sh
   npm run api:start
   ```
4. In a separate terminal, copy `.env.example` to `.env` in this directory and adjust `CORS_ORIGIN` to the frontend's origin:
   ```powershell
   Copy-Item apps/backend/.env.example apps/backend/.env
   ```
   On macOS/Linux: `cp apps/backend/.env.example apps/backend/.env`.
5. Start this backend from the repository root:
   ```sh
   npm run backend:start
   ```

The backend defaults to `http://localhost:3001`; the nutrition microservice defaults to `http://localhost:3000`. Configure URLs, port, timeout, and allowed frontend origin using environment variables, never hard-coded credentials.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---:|---|---|
| `PORT` | No | `3001` | Backend HTTP port |
| `NUTRITION_API_BASE_URL` | No | `http://localhost:3000/api/v1` | Nutrition microservice base URL |
| `NUTRITION_API_TIMEOUT_MS` | No | `5000` | Upstream request timeout |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Comma-separated allowed frontend origins |

## Endpoints

All endpoints are served from `http://localhost:3001`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Backend health check |
| POST | `/api/v1/auth/login` | No | Forward login to the nutrition service |
| POST | `/api/v1/auth/refresh` | No | Forward access-token refresh |
| GET | `/api/v1/nutrition/search?query=banana&page=1&pageSize=20` | No | Search foods |
| GET | `/api/v1/nutrition/macro-breakdown/:foodId?quantityGrams=150` | No | Calculate serving macros |
| POST | `/api/v1/nutrition/logs` | Bearer access token | Create a nutrition log; forwards authorization to the microservice |

Successful upstream response bodies and status codes are preserved. Validation and authentication errors are returned as JSON with the microservice's 400/401 status. If the microservice cannot be reached, the backend returns a generic 502 error without exposing network details.

Run the backend integration tests with `npm run backend:test`, or all workspace tests with `npm test`.

Use [api.http](./api.http) with a compatible REST client to exercise the backend.

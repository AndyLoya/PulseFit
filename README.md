# PulseFit Nutrition Microservice

A production-oriented Node.js/Express REST service for the PulseFit Nutrition module. It searches Open Food Facts, calculates serving-level macronutrients, and accepts authenticated nutrition logs. Food-provider failures are handled as a clean fallback. Logs are held in memory for this service example; replace the repository implementation with your platform database for multi-instance production use.

## Setup

1. Install Node.js 18 or newer.
2. Install dependencies:
   ```sh
   npm install
   ```
3. Create local configuration:
   ```sh
   copy .env.example .env
   ```
   On macOS/Linux use `cp .env.example .env`. Replace the JWT secret with a long random value. Never commit `.env`.
4. Start the service:
   ```sh
   npm start
   ```
5. The API is available at `http://localhost:3000/api/v1/nutrition`.

Generate a matching JWT locally with:
```sh
node -e "console.log(require('jsonwebtoken').sign({sub:'test-user'}, process.env.JWT_SECRET || 'replace-with-a-long-random-secret', {expiresIn:'1h'}))"
```
Load the same `.env` secret before running that command in your shell.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---:|---|---|
| `PORT` | No | `3000` | HTTP port |
| `JWT_SECRET` | Yes | None | Secret used to verify Bearer JWTs |
| `OPEN_FOOD_FACTS_BASE_URL` | No | `https://world.openfoodfacts.org` | Public food provider base URL |
| `OPEN_FOOD_FACTS_TIMEOUT_MS` | No | `5000` | Provider request timeout in milliseconds |
| `NODE_ENV` | No | `development` | Runtime environment |

## Endpoints

| Method | Path | Authentication | Description |
|---|---|---|---|
| GET | `/api/v1/nutrition/search?query=banana&page=1&pageSize=20` | None | Search foods. Provider failures return a successful response with an empty result and `fallback: true`. |
| GET | `/api/v1/nutrition/macro-breakdown/:foodId?quantityGrams=150` | None | Calculate calories and protein, carbohydrate, and fat totals for `quantityGrams` (defaults to 100 g). |
| POST | `/api/v1/nutrition/logs` | Bearer JWT | Validate and create a nutrition log. |

## Validation and errors

Invalid input returns HTTP 400 as:
```json
{ "error": "Invalid input", "details": ["field-specific message"] }
```
Missing/invalid JWTs return HTTP 401, provider failures use safe fallbacks, and unexpected failures return a generic HTTP 500 without stack traces.

## Sample log body

```json
{
  "foodId": "3017620422003",
  "quantityGrams": 150,
  "mealType": "snack",
  "consumedAt": "2026-11-04T18:36:58Z"
}
```

Use [api.http](./api.http) with a compatible REST client for prepared requests.

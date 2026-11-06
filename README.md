# PulseFit Monorepo

PulseFit is organized as a monorepo with separate application folders.

## Structure

```text
apps/
├── nutrition-api/  # Nutrition microservice and Open Food Facts integration
├── backend/        # Application API that consumes the nutrition microservice
└── frontend/       # Reserved for the team's frontend (not yet added)
```

## Run locally

Install dependencies once from the repository root:

```sh
npm install
```

Start the nutrition microservice in one terminal:

```sh
npm run api:start
```

Start the application backend in another terminal:

```sh
npm run backend:start
```

The backend listens on `http://localhost:3001` and forwards the nutrition routes to the microservice at `http://localhost:3000/api/v1`. Configure each service using its `.env.example` file. The backend's `CORS_ORIGIN` should match the frontend origin.

The microservice API documentation and REST client collection are in `apps/nutrition-api/`; the application backend documentation and REST client collection are in `apps/backend/`.

## Available root commands

| Command | Purpose |
|---|---|
| `npm run api:start` | Start the nutrition microservice |
| `npm run api:dev` | Start the microservice with Node watch mode |
| `npm run api:test` | Run the microservice tests |
| `npm run backend:start` | Start the application backend |
| `npm run backend:dev` | Start the backend with Node watch mode |
| `npm run backend:test` | Run the backend integration tests |
| `npm test` | Run all API and backend tests |

The backend integration module is `apps/backend/src/services/nutrition-api.client.js`; it forwards requests to the separately running nutrition microservice. No frontend files are changed by this backend implementation.

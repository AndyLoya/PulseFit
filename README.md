# PulseFit Monorepo

PulseFit is organized as a monorepo with separate application folders.

## Structure

```text
apps/
├── nutrition-api/  # Existing PulseFit Nutrition REST API
├── backend/        # Reserved for the team's backend (not yet added)
└── frontend/       # Reserved for the team's frontend (not yet added)
```

## Nutrition API

```sh
npm install
npm run api:start
```

The API documentation and REST client collection are located in `apps/nutrition-api/`.

## Available root commands

| Command | Purpose |
|---|---|
| `npm run api:start` | Start the Nutrition API |
| `npm run api:dev` | Start the API with Node watch mode |
| `npm run api:test` | Run the Nutrition API tests |

Backend and frontend folders intentionally contain placeholders only and do not yet have application code.

# JWT Authentication Simulation Guide

This guide reproduces authentication against the PulseFit Nutrition microservice.

## 1. Environment

- Install Node.js 18+, then run `npm install`.
- Copy `.env.example` to `.env`.
- Replace `JWT_SECRET` with a random secret of at least 32 bytes and generate the configured password hash for the demo account.
- The included local demo password is only for the classroom simulation; do not use it in production.
- Start: `npm start`; base URL: `http://localhost:3000`.

## 2. Authentication endpoints

| Method | URL | Body | Success | Authentication errors |
|---|---|---|---|---|
| POST | `/api/v1/auth/login` | `{ "username": "pulsefit-demo", "password": "pulsefit-demo-password" }` | 200: access and refresh tokens | 401 invalid credentials |
| POST | `/api/v1/auth/refresh` | `{ "refreshToken": "..." }` | 200: new access token | 401 invalid/expired token |
| POST | `/api/v1/nutrition/logs` | Food log JSON | 201 | 401 missing/invalid token; 400 invalid body |

## 3. Log in

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json

{"username":"pulsefit-demo","password":"pulsefit-demo-password"}
```

The server compares the supplied password with the bcrypt hash in `DEMO_USER_PASSWORD_HASH`. Password plaintext is never stored or placed in the JWT. Save the returned access token; send it in an Authorization header on protected requests.

## 4. Decode the token

Paste the access token into jwt.io. Confirm that:

- `alg` is `HS256` in the header and the algorithm is pinned during verification.
- `typ` is `JWT`.
- `sub` contains the authenticated demo identity.
- `type` distinguishes `access` from `refresh`.
- `iat` is the issued-at time.
- `exp` is the calculated expiry.

The payload must not contain passwords or personal data.

## 5. Protected request

```http
POST http://localhost:3000/api/v1/nutrition/logs
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{"foodId":"3017620422003","quantityGrams":150,"mealType":"snack"}
```

Success is `201`; it proves signature, expiry, algorithm, and access-token type were accepted.

## 6. Negative cases

Without the header, the service returns `401`. Change one character in the token and return it in the same header; verification returns `401`. A refresh token used at this endpoint is also rejected. These differ from authorization failures (403), because the identity is unknown or invalid rather than authenticated but insufficiently privileged.

## 7. Expiry and renewal

The access token lasts 15 minutes by default. The refresh token lasts 7 days. Send the refresh token to `/api/v1/auth/refresh` to obtain an access token; otherwise log in again. Refresh tokens must be revoked if a real account logout is implemented, which this simulation does not persist.

## 8. Security analysis

The bcrypt hash is environment-configured; JWT signing uses a pinned symmetric algorithm; verification uses an allowlist; auth routes are rate-limited; and the response never exposes server stack traces. Browser applications should store short-lived access tokens in memory and refresh tokens in a Secure, HttpOnly, SameSite cookie. Plain HTTP is acceptable only for localhost classroom testing; deploy behind HTTPS. Remaining production risks include distributed refresh-token revocation, logout storage, stronger account database controls, and multi-instance secret distribution.

## Evidence checklist

Capture or paste the actual output for login, decoded claims, successful protected request, missing token, modified token, refresh, invalid input, and `npm test`. Replace the command-line output placeholders below with screenshots in the final submitted PDF if required.

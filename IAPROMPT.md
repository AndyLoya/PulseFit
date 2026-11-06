# IAPROMPT - Guía para continuar PulseFit

Lee este documento y los README enlazados antes de modificar el proyecto. El frontend debe consumir el backend de la aplicación; no debe llamar directamente al microservicio de nutrición ni a Open Food Facts.

## Contexto y arquitectura actual

Este repositorio es un monorepo Node.js con dos servicios:

1. `apps/backend`: API Express orientada al frontend. Expone rutas de aplicación y reenvía las operaciones de nutrición al microservicio.
2. `apps/nutrition-api`: microservicio Express existente. Implementa búsqueda de alimentos, cálculo de macros, autenticación JWT y registro de consumo. Consulta Open Food Facts desde el servidor.
3. `apps/frontend`: directorio reservado al frontend; su implementación no forma parte del backend.

Flujo:

```text
Frontend -> apps/backend (puerto 3001) -> apps/nutrition-api (puerto 3000) -> Open Food Facts
```

El backend de `apps/backend` es actualmente una capa de integración/proxy; no es una base de datos ni reemplaza la lógica del microservicio. El registro de nutrición aún se almacena en memoria en el microservicio, por lo que se pierde al reiniciar y no es una solución de persistencia para producción.

Lee también:

- [README de la raíz](./README.md)
- [README del backend](./apps/backend/README.md)
- [README del microservicio](./apps/nutrition-api/README.md)

## Configuración e inicio

Requisito: Node.js 18 o posterior.

Instala dependencias desde la raíz:

```sh
npm install
```

Configura `apps/nutrition-api/.env` a partir de `apps/nutrition-api/.env.example`. Como mínimo, establece un `JWT_SECRET` aleatorio y una contraseña demo con su hash bcrypt en `DEMO_PASSWORD_HASH` (o `DEMO_USER_PASSWORD_HASH`). No subas archivos `.env` al repositorio.

Configura `apps/backend/.env` a partir de `apps/backend/.env.example`. Valores por defecto:

```dotenv
PORT=3001
NUTRITION_API_BASE_URL=http://localhost:3000/api/v1
NUTRITION_API_TIMEOUT_MS=5000
CORS_ORIGIN=http://localhost:5173
```

`CORS_ORIGIN` debe coincidir con el origen real del frontend. Admite varios orígenes separados por comas.

Inicia cada servicio en una terminal distinta, desde la raíz:

```sh
npm run api:start
npm run backend:start
```

El frontend debe usar `http://localhost:3001` como URL base en desarrollo. No pongas el JWT secret, credenciales ni la URL de Open Food Facts en el código del navegador.

## API que debe consumir el frontend

Todas estas rutas pertenecen al backend de la aplicación (`http://localhost:3001`). Los prefijos y las respuestas de nutrición se reenvían al microservicio.

| Método | Ruta | Autenticación | Uso |
|---|---|---|---|
| `GET` | `/health` | No | Comprobar que el backend responde. |
| `POST` | `/api/v1/auth/login` | No | Iniciar sesión; reenvía credenciales demo al microservicio. |
| `POST` | `/api/v1/auth/refresh` | No | Renovar el access token. |
| `GET` | `/api/v1/nutrition/search?query=banana&page=1&pageSize=20` | No | Buscar alimentos. |
| `GET` | `/api/v1/nutrition/macro-breakdown/:foodId?quantityGrams=150` | No | Obtener macros calculados para una cantidad en gramos. |
| `POST` | `/api/v1/nutrition/logs` | Bearer access token | Registrar un alimento consumido. |

### Login

Petición:

```http
POST /api/v1/auth/login
Content-Type: application/json

{"username":"pulsefit-demo","password":"<contraseña configurada>"}
```

La respuesta exitosa contiene `accessToken`, `refreshToken`, `tokenType` y `expiresIn`. El frontend debe guardar y enviar el access token como `Authorization: Bearer <accessToken>` al crear un registro. El backend reenvía ese header al microservicio, que valida el JWT. No confíes en que la interfaz proteja por sí sola una operación.

### Búsqueda y macros

Ejemplo de búsqueda:

```http
GET /api/v1/nutrition/search?query=banana&page=1&pageSize=20
```

La respuesta exitosa incluye `query`, `source`, `count`, `products` y `fallback`. Cada producto puede incluir `foodId`, `name`, `brand` e `imageUrl`. Si falla el proveedor, el microservicio responde con una lista vacía y `fallback: true`; la interfaz debe mostrar un estado comprensible y permitir reintentar.

Ejemplo de macros:

```http
GET /api/v1/nutrition/macro-breakdown/3017620422003?quantityGrams=150
```

La respuesta contiene `foodId`, `name`, `quantityGrams`, `unit` y `macros` (`calories`, `proteinG`, `carbsG`, `fatG`). La cantidad predeterminada es 100 g si se omite.

### Registro de consumo

Petición:

```http
POST /api/v1/nutrition/logs
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "foodId": "3017620422003",
  "quantityGrams": 150,
  "mealType": "snack"
}
```

`mealType` acepta `breakfast`, `lunch`, `dinner` o `snack`. `consumedAt` es opcional; si se omite, el microservicio asigna la hora actual. Un registro válido responde con `201`.

Ejemplo mínimo con `fetch`:

```js
const API_URL = 'http://localhost:3001';

const response = await fetch(`${API_URL}/api/v1/nutrition/search?query=banana`, {
  headers: { Accept: 'application/json' }
});
const data = await response.json();

if (!response.ok) {
  throw new Error(data.error || 'No se pudo buscar alimentos');
}
```

## Errores que debe manejar el frontend

- `400`: datos inválidos; respuesta JSON con `error` y, normalmente, `details`.
- `401`: falta un JWT válido o las credenciales de login no son correctas. Pedir iniciar sesión o renovar el token según corresponda.
- `404`: alimento desconocido en el endpoint de macros o ruta inexistente.
- `502`: el backend no pudo usar el microservicio o éste devolvió un error 5xx. Mostrar un mensaje de servicio temporalmente no disponible.
- `500`: error interno genérico; el cliente no recibe trazas ni detalles de infraestructura.

El backend también responde `400` con JSON cuando recibe un cuerpo JSON malformado. Las respuestas de validación y autenticación 4xx del microservicio se reenvían al frontend.

## Estructura de implementación

- `apps/backend/server.js`: Express, CORS, parser JSON, health check, rutas y manejo central de errores.
- `apps/backend/src/routes/`: rutas de autenticación y nutrición disponibles para el frontend.
- `apps/backend/src/controllers/`: traduce cada solicitud y reenvía la respuesta.
- `apps/backend/src/services/nutrition-api.client.js`: llamadas HTTP al microservicio, timeout, propagación del JWT y saneamiento de fallos upstream.
- `apps/backend/test/`: pruebas del backend con microservicio simulado y prueba end-to-end con proveedor local simulado.
- `apps/nutrition-api/`: servicio nutricional, autenticación y conexión con Open Food Facts.

Mantén la lógica de consulta al proveedor y cálculo de macros en el microservicio. Si agregas funcionalidades de aplicación que no pertenecen a nutrición, impleméntalas en el backend de la aplicación sin duplicar la integración con Open Food Facts.

## Pruebas y definición de terminado

Ejecuta desde la raíz:

```sh
npm run backend:test
npm run api:test
npm test
```

Las pruebas actuales usan servicios locales simulados para no depender de Open Food Facts ni de acceso a Internet. Antes de entregar cambios:

1. Verifica `npm test` y `git diff --check`.
2. Añade o actualiza pruebas para cada endpoint o comportamiento modificado.
3. Comprueba respuestas de éxito y errores relevantes, incluida la autenticación para las rutas protegidas.
4. No añadas secretos ni archivos `.env` al repositorio.
5. Si cambias rutas, variables o pasos de configuración, actualiza este documento y los README correspondientes.

## Límites conocidos / siguientes pasos de producción

- Los usuarios son una cuenta demo configurada por variables de entorno; no hay registro de usuarios ni integración con un proveedor de identidad real.
- Los registros de comida viven en memoria y no tienen endpoints de consulta, actualización o borrado. Para persistencia real hace falta elegir e integrar una base de datos, definir el esquema y aislar datos por usuario.
- El refresh token no tiene revocación persistente.
- El servicio requiere configuración de secretos y HTTPS en un despliegue real.
- No asumas que una prueba con proveedor simulado verifica disponibilidad actual de Open Food Facts.


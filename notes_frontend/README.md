# Simple Notes (notes_frontend)

This is a lightweight single-page notes application built with React. It runs fully offline by default using `localStorage`, and it can optionally switch to a REST backend using environment variables.

## Storage modes (local vs REST API)

The app selects the notes “service” at runtime (see `src/hooks/useNotesService.js`):

If `REACT_APP_API_BASE` or `REACT_APP_BACKEND_URL` is set (and is non-empty after trimming whitespace), the app runs in REST API mode. Otherwise, it runs in local mode backed by `window.localStorage`. The active mode is shown in the header (Mode: Local / API).

## Environment variables and base URL wiring

REST mode is controlled by these environment variables:

`REACT_APP_API_BASE` is the preferred base URL for the REST API. `REACT_APP_BACKEND_URL` is a fallback base URL for the REST API used only when `REACT_APP_API_BASE` is not set.

In code, the base URL is selected as:

1. `process.env.REACT_APP_API_BASE`, otherwise
2. `process.env.REACT_APP_BACKEND_URL`, otherwise
3. an empty string (meaning local mode)

The chosen base URL is then coerced to a string and trimmed. If the trimmed base URL is empty, REST mode is disabled and the app uses localStorage.

Important: Create React App only exposes environment variables prefixed with `REACT_APP_`. You must restart the dev server after changing environment variables.

## REST API contract

When REST mode is enabled, the frontend expects a JSON REST API with these endpoints (implemented by the frontend client in `src/services/restNotesService.js`):

- `GET /notes`
- `POST /notes`
- `GET /notes/:id`
- `PUT /notes/:id`
- `DELETE /notes/:id`

Returned note objects are normalized client-side into the canonical shape shown below.

### Canonical Note shape

All notes used by the UI conform to this shape:

```json
{
  "id": "string",
  "title": "string",
  "body": "string",
  "createdAt": 1700000000000,
  "updatedAt": 1700000000000
}
```

The timestamps are Unix epoch milliseconds. The backend may return strings, numbers, or other timestamp formats; the app normalizes them on a best-effort basis.

### Endpoints

#### List notes

`GET /notes`

The response should be a JSON array of notes.

Example response:

```json
[
  {
    "id": "1",
    "title": "A",
    "body": "B",
    "createdAt": 1700000000000,
    "updatedAt": 1700000001000
  }
]
```

#### Create note

`POST /notes`

The request body is JSON:

```json
{ "title": "string", "body": "string" }
```

The response should be the created JSON note (recommended). If the response is missing timestamps, the frontend fills them with the current time. If the response omits some fields, the frontend uses request values as fallback.

#### Get note

`GET /notes/:id`

The response should be a JSON note, or it can be `null` / 404 depending on your backend implementation. The frontend will treat a non-JSON response as `null`.

#### Update note

`PUT /notes/:id`

The request body is JSON:

```json
{ "title": "string", "body": "string" }
```

The response should be the updated JSON note (recommended). If the response omits fields, the frontend uses request fields and timestamps as fallback.

#### Delete note

`DELETE /notes/:id`

Any 2xx response is accepted. The frontend accepts an empty body (and generally ignores non-JSON delete responses).

### How the base URL is used

All REST calls are constructed from the selected base URL plus the endpoint path, using a safe join that removes duplicate slashes.

Examples:

- `REACT_APP_API_BASE=http://localhost:8080` + `/notes` becomes `http://localhost:8080/notes`
- `REACT_APP_API_BASE=http://localhost:8080/` + `/notes` becomes `http://localhost:8080/notes`
- `REACT_APP_API_BASE=https://api.example.com/v1` + `/notes/123` becomes `https://api.example.com/v1/notes/123`

## CORS and connecting to external APIs

In development, the React dev server runs on `http://localhost:3000`. If your REST API is on a different origin (for example `http://localhost:8080` or `https://api.example.com`), the backend must allow cross-origin requests from the frontend origin.

At minimum, configure your backend to include appropriate CORS headers, such as:

- `Access-Control-Allow-Origin: http://localhost:3000` (or `*` in non-production setups)
- `Access-Control-Allow-Headers: Content-Type`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`

Because the frontend uses `fetch` with `Content-Type: application/json`, your backend should also handle CORS preflight `OPTIONS` requests for at least `POST` and `PUT` (and often `DELETE`).

## Failure and fallback behavior

This repository ships fully functional without any backend.

The app has two distinct “fallback” concepts:

If `REACT_APP_API_BASE` and `REACT_APP_BACKEND_URL` are both absent (or only contain whitespace), the app always uses localStorage mode.

If REST mode is enabled but a REST call fails (network error, non-2xx HTTP status, invalid JSON, etc.), the app displays a toast error and attempts to keep the UI stable by preserving current notes, selection, and drafts wherever possible. In this situation, the app does not automatically switch to localStorage, but you can force local mode by unsetting the REST env vars and restarting the dev server.

## Quick start

### Local mode (no backend required)

From `notes_frontend/`:

```bash
npm install
npm start
```

Open `http://localhost:3000`.

### REST API mode

1. Ensure your backend implements the REST contract described above.
2. Set an API base URL and restart the dev server:

```bash
# Example: macOS/Linux
export REACT_APP_API_BASE="http://localhost:8080"
npm start
```

On Windows PowerShell:

```powershell
$env:REACT_APP_API_BASE="http://localhost:8080"
npm start
```

Alternatively, you can set `REACT_APP_BACKEND_URL` instead of `REACT_APP_API_BASE` (it has lower precedence).

## Troubleshooting

If the header still shows Mode: Local after setting `REACT_APP_API_BASE`, confirm that the variable name starts with `REACT_APP_` and that you restarted the dev server. Also ensure it is not an empty/whitespace-only string, because the app trims before deciding whether REST mode is enabled.

If you see CORS errors in the browser console, your API is rejecting cross-origin requests from `http://localhost:3000`. Configure the backend’s CORS settings and ensure it responds correctly to `OPTIONS` preflight requests.

If you see “HTTP 404” or “HTTP 500” errors in toast notifications, verify that your base URL does not already include an incompatible path prefix, and confirm that your backend implements the required endpoints exactly (including `/notes/:id`).

## Learn More

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

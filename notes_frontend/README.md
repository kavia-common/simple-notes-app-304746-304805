# Simple Notes (notes_frontend)

This is a lightweight single-page notes application built with React. It runs fully offline by default using `localStorage`, and it can optionally switch to a REST backend using environment variables.

## Storage modes (local vs REST API)

The app selects the notes “service” at runtime:

- If `REACT_APP_API_BASE` or `REACT_APP_BACKEND_URL` is set (non-empty after trimming), the app runs in **REST API mode**.
- Otherwise, it runs in **Local mode** using `window.localStorage`.

This selection is implemented in `src/hooks/useNotesService.js`, and the UI displays the active mode in the header (Mode: Local / API).

### Environment variables

The following variables control REST mode:

- `REACT_APP_API_BASE`: Preferred base URL for the REST API (for example, `http://localhost:8080`).
- `REACT_APP_BACKEND_URL`: Fallback base URL for the REST API if `REACT_APP_API_BASE` is not set.

If both are set, `REACT_APP_API_BASE` takes precedence.

Important: Create React App only exposes variables prefixed with `REACT_APP_`. You must restart the dev server after changing environment variables.

## REST API contract

When REST mode is enabled, the frontend expects a JSON REST API with the following endpoints. Returned note objects are normalized client-side into the canonical shape shown below.

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

The timestamps are Unix epoch milliseconds. The backend may return strings or other timestamp formats; the app will normalize as best it can.

### Endpoints

#### List notes

- `GET /notes`
- Response: JSON array of notes

Example response:

```json
[
  { "id": "1", "title": "A", "body": "B", "createdAt": 1700000000000, "updatedAt": 1700000001000 }
]
```

#### Create note

- `POST /notes`
- Request body:

```json
{ "title": "string", "body": "string" }
```

- Response: JSON note (recommended). If the response is missing timestamps, the frontend will fill them.

Example response:

```json
{ "id": "123", "title": "New", "body": "", "createdAt": 1700000000000, "updatedAt": 1700000000000 }
```

#### Get note

- `GET /notes/:id`
- Response: JSON note (or `null`/404 depending on your implementation)

#### Update note

- `PUT /notes/:id`
- Request body:

```json
{ "title": "string", "body": "string" }
```

- Response: JSON note (recommended). If fields are missing, the frontend will use request fields and timestamps as fallback.

#### Delete note

- `DELETE /notes/:id`
- Response: any 2xx. The frontend accepts empty responses.

### Base URL joining rules

The REST service joins the configured base URL and paths safely by removing duplicate slashes.

Examples:

- `REACT_APP_API_BASE=http://localhost:8080` + `/notes` becomes `http://localhost:8080/notes`
- `REACT_APP_API_BASE=http://localhost:8080/` + `/notes` becomes `http://localhost:8080/notes`
- `REACT_APP_API_BASE=https://api.example.com/v1` + `/notes/123` becomes `https://api.example.com/v1/notes/123`

## CORS and different origins

In development, the React dev server runs on `http://localhost:3000`. If your API is on a different origin (for example `http://localhost:8080`), your backend must allow cross-origin requests.

At minimum, configure your backend to include appropriate CORS headers, such as:

- `Access-Control-Allow-Origin: http://localhost:3000` (or `*` in non-production setups)
- `Access-Control-Allow-Headers: Content-Type`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`

Because the frontend uses `fetch` with `Content-Type: application/json`, your backend should also handle preflight `OPTIONS` requests for `POST` and `PUT`.

## Failure and fallback behavior

This repository ships fully functional without any backend.

When REST mode is enabled and a REST call fails (network error, non-2xx HTTP status, invalid JSON, etc.), the UI is designed to remain stable:

- Errors are surfaced via toast notifications (for example, “Load failed”, “Save failed”, “Delete failed”).
- The app preserves current notes, selection, and drafts on transient failures wherever possible, to avoid losing user input.
- Local mode continues to work offline and is the default when no API base URL is configured.

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

# Example: Windows PowerShell
$env:REACT_APP_API_BASE="http://localhost:8080"
npm start
```

Alternatively, you can set `REACT_APP_BACKEND_URL` instead of `REACT_APP_API_BASE`.

## Learn More

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

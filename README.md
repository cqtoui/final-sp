# AI SafeGuard

Workplace PPE monitoring: a React UI plus a FastAPI backend that matches faces (DeepFace) and checks safety gear (YOLO).

## Prerequisites

- Node.js 18+
- Python 3.11+
- A trained YOLO weight at one of:
  - `backend/models/best_v6.pt` (preferred)
  - `backend/models/best_v5.pt` (rollback)
  - `backend/models/best_v4.pt`
  - `backend/models/best_v3.pt`
  - `backend/models/best_v2.pt`

## Setup

```bash
copy .env.example .env
```

`VITE_API_KEY` and `SAFEGUARD_API_KEY` must match. Vite proxies `/api` to `http://127.0.0.1:8000`, so you can leave `VITE_API_URL` empty in local development.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Run from the `backend` folder so model and `worker_data` paths resolve correctly.

### Frontend

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Production build

```bash
# Set VITE_API_URL to the public API origin if the UI is not served through the Vite proxy.
npm run build
npm run preview
```

Static hosts must rewrite unknown paths to `index.html` so routes such as `/workers` work after refresh.

Camera access needs a secure context: HTTPS in production, or localhost in development.

## API key

All `/api` routes and `/uploads` require header `X-API-Key` (or `?api_key=` on image URLs). `/health` stays public.

Set an admin password in Settings before edit/delete confirmations. There is no default password in the source.

## Tests

```bash
cd backend
.venv\Scripts\activate
pytest
```

Face photos are served only through `/api/workers/{id}/photo`, not as a public folder.

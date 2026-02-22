# Coaching Management System

Coaching institute management app with:
- JWT auth (`ADMIN`, `TEACHER`, `STUDENT`)
- Student, batch, attendance, notes, fees, reminders, notifications
- React frontend + Node/Express backend + SQLite

## Stack
- Frontend: React 18, Vite 6, TypeScript, Tailwind
- Backend: Node.js, Express, SQLite (`sqlite3` + `sqlite`)
- Auth: Access/refresh JWT tokens
- File handling: local storage for notes and generated receipts

## Current Project Structure
```text
backend/
  src/
    app.js
    auth.js
    config.js
    db.js
    seed.js
    server.js
    routes/
frontend/
  src/
docker-compose.yml
README.md
```

## Prerequisites
- Node.js 20+
- npm 10+

## Quick Start (Local)

Run backend:
```powershell
cd backend
npm install
npm run seed
npm run dev
```

Run frontend in a second terminal:
```powershell
cd frontend
npm install
npm run dev
```

App URLs:
- Frontend: `http://localhost:5173`
- Backend API base: `http://localhost:8000/api/v1`
- Health check: `http://localhost:8000/api/v1/health`

## Demo Credentials
- Admin: `admin@demo.com` / `Admin@123`
- Teacher: `teacher@demo.com` / `Teacher@123`
- Student: `student1@demo.com` / `Student@123`

## Backend Scripts
From `backend/`:
- `npm run dev` -> start API with nodemon
- `npm start` -> start API with node
- `npm run seed` -> initialize schema and seed demo data (skips if users already exist)

## Frontend Scripts
From `frontend/`:
- `npm run dev` -> Vite dev server
- `npm run build` -> type-check + production build
- `npm run preview` -> preview built assets

## Environment Variables
Backend reads `.env` from `backend/` (all optional; defaults shown):

```env
APP_NAME=Coaching Management System API
ENVIRONMENT=development
API_PREFIX=/api/v1
PORT=8000

SECRET_KEY=change-me-in-env
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=10080

DATABASE_URL=sqlite:///./coaching.db
STORAGE_DIR=./storage

CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
RATE_LIMIT_PER_MINUTE=120
RUN_SCHEDULER=true

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_SENDER=
```

Frontend environment (`frontend/.env`):

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## API Route Overview
All routes are under `API_PREFIX` (default `/api/v1`):

- `GET /health`
- `Auth`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/register` (admin only)
- `Users`
- `GET /users/teachers`
- `Students`
- `GET /students`
- `POST /students`
- `PATCH /students/:id`
- `PATCH /students/:id/disable`
- `PUT /students/:id/batches`
- `Batches`
- `GET /batches`
- `POST /batches`
- `PATCH /batches/:id`
- `DELETE /batches/:id`
- `GET /batches/:id/students`
- `GET /batches/:id/schedule`
- `Attendance`
- `POST /attendance/mark`
- `GET /attendance/history`
- `GET /attendance/stats`
- `GET /attendance/export`
- `Notes`
- `POST /notes`
- `GET /notes`
- `GET /notes/:id/download`
- `Fees`
- `GET|POST|PATCH|DELETE /fees/plans`
- `PATCH /fees/batches/:batchId/plan`
- `GET|POST /fees/student-fees`
- `GET|POST /fees/payments`
- `GET /fees/payments/:paymentId/receipt`
- `GET /fees/dues`
- `Notifications`
- `GET /notifications`
- `PATCH /notifications/:id/read`
- `POST /notifications/announcements`
- `POST /notifications/run-reminders`
- `GET|POST /notifications/reminder-rules`
- `PATCH|DELETE /notifications/reminder-rules/:id`
- `GET /notifications/:id/whatsapp-template`
- `Dashboard`
- `GET /dashboard/admin`
- `GET /dashboard/student`

## Data and Storage
- SQLite DB file: `backend/coaching.db` (default)
- Uploaded notes: `backend/storage/notes`
- Generated receipts: `backend/storage/receipts`

## Troubleshooting
- `401 Unauthorized` from frontend
- Ensure you are logged in and app routes are protected.
- Confirm `VITE_API_BASE_URL` matches backend URL and prefix.
- Verify backend `SECRET_KEY` is stable between login and refresh.
- `CORS` issues in browser
- Add frontend origin to `CORS_ORIGINS`.
- PowerShell blocks `npm` script execution
- Use `npm.cmd` instead of `npm` in PowerShell.

## Docker Note
`docker-compose.yml` in this repo appears to reference an older Python/FastAPI setup and does not match the current Node/Express backend entrypoints. Prefer local npm-based setup unless compose is updated.

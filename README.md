# Coaching Management System

Production-ready local web app for coaching institutes and tuition owners.

## Tech Stack
- Backend: FastAPI + SQLAlchemy ORM + Alembic + SQLite
- Frontend: React + Vite + TypeScript + TailwindCSS
- Auth: JWT access/refresh tokens with role-based access (`ADMIN`, `TEACHER`, `STUDENT`)
- Scheduler: APScheduler for fee reminder notifications
- Storage: local filesystem (`backend/storage`) for notes and receipts

## Features
- Student management (create, edit, disable, assign batches)
- Batch management (teacher/course/schedule/date/fee plan mapping)
- Attendance marking (bulk by batch/date), history, stats, CSV export
- Notes/study material upload and secure downloads
- Fee plans, student fee mapping, installments, payments, dues tracking
- Receipt PDF generation
- Reminder system with global/per-batch reminder rules
- Notifications and announcements
- Student portal dashboard (attendance, notes, fees, notifications)
- Audit logs for attendance and payment changes
- Pagination/search/filter support
- Basic IP rate limiting middleware

## Project Structure
```
backend/
  app/
  alembic/
  tests/
frontend/
docker-compose.yml
README.md
```

## Prerequisites
- Python 3.11+
- Node.js 20+
- npm 10+

## Environment Setup

### Backend `.env`
1. Copy:
   - `backend/.env.example` -> `backend/.env`
2. Minimum recommended values:
   - `SECRET_KEY=<your-random-secret>`
   - `DATABASE_URL=sqlite:///./coaching.db`

### Frontend `.env`
1. Copy:
   - `frontend/.env.example` -> `frontend/.env`
2. Default:
   - `VITE_API_BASE_URL=http://localhost:8000/api/v1`

## Run Locally (No Docker)

### Windows (PowerShell)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python seed.py
uvicorn app.main:app --reload --port 8000
```

In a second terminal:
```powershell
cd frontend
npm install
npm run dev
```

### Linux/macOS (bash)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python seed.py
uvicorn app.main:app --reload --port 8000
```

In a second terminal:
```bash
cd frontend
npm install
npm run dev
```

## Demo Credentials
- Admin: `admin@demo.com` / `Admin@123`
- Teacher: `teacher@demo.com` / `Teacher@123`
- Student: `student1@demo.com` / `Student@123`

## API Docs
- Swagger: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Run Tests
```bash
cd backend
python -m pytest -q
```

## Troubleshooting (Windows)
- If you see a bcrypt/passlib error like `module 'bcrypt' has no attribute '__about__'`, reinstall pinned bcrypt:
```bat
cd backend
pip install --force-reinstall "bcrypt==4.0.1"
```

## Docker (Optional)
```bash
docker compose up --build
```
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

## Notes
- Files uploaded from Notes module are saved under `backend/storage/notes`.
- Receipt PDFs are generated dynamically from payment data.
- Reminder scheduler runs in background every 30 minutes by default.

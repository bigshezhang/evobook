# EvoBook

AI-powered personalized learning platform.

## 🏗️ Project Structure

```
EvoBook/
├── frontend/    # React + Vite frontend application
├── backend/     # FastAPI backend service
└── docs/        # Documentation (inside backend/)
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (for frontend)
- Python 3.11+ (for backend)
- PostgreSQL 14+ (for backend)

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

Visit: http://localhost:5173

### Backend Development

```bash
cd backend

# Setup virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e .

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

## 📚 Documentation

- [Frontend README](./frontend/README.md)
- [Backend README & Runbook](./backend/docs/runbook-local.md)
- [API Contract](./backend/docs/api-contract.md)

## 🔗 Repository

This is a monorepo combining:
- Frontend (originally `gemma1044/evobook`)
- Backend (originally `bigshezhang/evobook_be`)

Complete git history from both repositories has been preserved.

## 📄 License

[Add your license here]

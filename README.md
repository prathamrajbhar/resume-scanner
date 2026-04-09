# AI HR Copilot

A production-ready AI-powered HR application with a ChatGPT-style interface for resume ranking and candidate comparison.

## Tech Stack
- **Frontend**: Next.js 14, Tailwind CSS, ShadCN UI
- **Backend**: FastAPI (Python 3.11)
- **Database**: PostgreSQL
- **Storage**: Google Drive API
- **AI Models**: BERT, TF-IDF, Hybrid, Deep Ensemble (from NLP-G1)

## Folder Structure
- `backend/`: FastAPI application code.
- `frontend/`: Next.js application code.
- `NLP-G1/`: Core NLP models and logic.

## Prerequisites
- Docker & Docker Compose
- Node.js 18+ & npm
- Python 3.11+
- Google Cloud Project with Drive and Gmail APIs enabled

## Setup Instructions

### 1. Backend Setup (FastAPI)
1.  **Open a terminal** and navigate to the `backend` folder:
    ```bash
    cd backend
    ```
2.  **Create a `.env` file** (if you haven't already) based on the template.
3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
4.  **Generate Prisma client and push schema**:
    ```bash
    prisma generate --schema=prisma/schema.prisma
    prisma db push --schema=prisma/schema.prisma
    ```
4.  **Start the server**:
    ```bash
    uvicorn app.main:app --reload
    ```
    *Note: The server will be available at http://localhost:8000*

### 2. Frontend Setup (Next.js)
1.  **Open a NEW terminal** and navigate to the `frontend` folder:
    ```bash
    cd frontend
    ```
2.  **Install dependencies**:
    ```bash
    pnpm install
    ```
3.  **Generate Prisma client and sync schema (for Next API DB routes)**:
    ```bash
    pnpm prisma:generate
    pnpm prisma:push
    ```
4.  **Start the dev server**:
    ```bash
    pnpm dev
    ```
    *Note: The UI will be available at http://localhost:3000*

### 3. Docker Deployment (Combined)
If you have Docker installed, you can simply run from the **root** folder:
```bash
docker-compose up --build
```

## Key Features
- **ChatGPT-like Chat**: Ask qualitative questions about candidates or provide JDs.
- **Resume Ranking**: Instant scoring using 4 different NLP models.
- **Gmail Integration**: Automatically fetch new resumes from your inbox.
- **Candidate Comparison**: Detailed side-by-side view with scoring breakdown.
- **Google Drive Storage**: Secure cloud storage for all parsed resumes.

## API Documentation
Once the backend is running, access the interactive docs at:
`http://localhost:8000/docs`

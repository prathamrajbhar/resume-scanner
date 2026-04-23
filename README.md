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

For a complete walkthrough of the environment setup, including local LLM configuration with **Ollama**, please refer to the detailed guide:

👉 [**Full Setup Guide (SETUP_GUIDE.md)**](./SETUP_GUIDE.md)

For instructions on how to use the application features like resume ranking, analysis, and AI chat:

👉 [**User Usage Guide (USAGE_GUIDE.md)**](./USAGE_GUIDE.md)

---

### Quick Start (Abbreviated)

### 1. Backend Setup (FastAPI)
1.  **Open a terminal** and navigate to the `backend` folder:
    ```bash
    cd backend
    ```
2.  **Create a `.env` file** (if you haven't already) based on the template.
    Add these values in `backend/.env` to send login/register notification emails to the HR account:
    ```env
    AUTH_EMAIL_NOTIFICATIONS_ENABLED=true
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USERNAME=your-gmail@gmail.com
    SMTP_PASSWORD=your-16-digit-gmail-app-password
    SMTP_FROM_EMAIL=your-gmail@gmail.com
    SMTP_FROM_NAME=AI HR Copilot
    ```
    Gmail setup notes:
    - Enable 2-Step Verification on the sender Gmail account.
    - Generate an App Password from Google Account -> Security -> App passwords.
    - Put that 16-character App Password in `SMTP_PASSWORD`.
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

## Screenshots

### Login Page
![Login Page](public/screenshots/01-login-page.png)
*User authentication page with Google OAuth and email/password login options.*

### Dashboard
![Dashboard](public/screenshots/02-dashboard.png)
*Main dashboard displaying overview statistics, recent candidates, and quick actions.*

### Chatbase Page
![Chatbase](public/screenshots/03-chatbase-page.png)
*AI-powered chat interface for asking questions about candidates and job descriptions.*

### Analytics Page
![Analytics](public/screenshots/04-analytics-page.png)
*Detailed analytics and insights with candidate scoring breakdown and comparisons.*

## API Documentation
Once the backend is running, access the interactive docs at:
`http://localhost:8000/docs`

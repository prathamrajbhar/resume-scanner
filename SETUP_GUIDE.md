# Resume Scanner - Full Setup Guide

This guide provides detailed instructions to set up the Resume Scanner project from scratch, including local AI integration via Ollama.

## 1. Prerequisites

Ensure you have the following installed on your system:
- **Node.js**: v18 or newer (required for the frontend)
- **pnpm**: `npm install -g pnpm`
- **Python**: v3.11 or newer (required for the backend)
- **PostgreSQL**: Local instance or a Docker container running
- **Docker & Docker Compose**: (Optional but recommended for simplified setup)
- **Google Cloud Assets**: API keys for Google Drive and Gmail (if using those integrations)

---

## 2. Ollama & Local LLM Setup

The Resume Scanner uses Ollama for local, privacy-focused resume parsing and intelligence.

### Installation
1.  **Download Ollama**: Visit [ollama.com](https://ollama.com) and download for your OS (macOS, Linux, or Windows).
2.  **Verify**: Open a terminal and run `ollama --version`.

### Model Preparation
By default, the project is configured to use `qwen2.5-coder:7b`.
1.  **Pull the model**:
    ```bash
    ollama pull qwen2.5-coder:7b
    ```
2.  **Alternative Models**: If you want to use a different model (like `llama3`), pull it:
    ```bash
    ollama pull llama3
    ```

### Running Ollama
Ensure the Ollama server is running in the background. Usually, it starts automatically on login, but you can start it manually:
```bash
ollama serve
```

---

## 3. Database & Shared Infrastructure

1.  **Start PostgreSQL**: Ensure your database service is running and you have a connection string ready.
    - Example: `postgresql://user:password@localhost:5432/resume_scanner`

---

## 4. Backend Setup (FastAPI)

1.  **Navigate to backend**:
    ```bash
    cd backend
    ```
2.  **Create Virtual Environment** (Recommended):
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
4.  **Configuration**:
    Create a `.env` file in the `backend/` directory:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/resume_scanner"
    OLLAMA_BASE_URL="http://localhost:11434"
    OLLAMA_MODEL="qwen2.5-coder:7b"
    SECRET_KEY="your_secure_random_key"
    ```
5.  **Initialize Database**:
    ```bash
    prisma generate
    prisma db push
    ```
6.  **Run Server**:
    ```bash
    uvicorn app.main:app --reload
    ```

---

## 5. Frontend Setup (Next.js)

1.  **Navigate to frontend**:
    ```bash
    cd frontend
    ```
2.  **Install Dependencies**:
    ```bash
    pnpm install
    ```
3.  **Configuration**:
    Create a `.env` file in the `frontend/` directory:
    ```env
    NEXT_PUBLIC_API_URL="http://localhost:8000/api/v1"
    ```
4.  **Sync Prisma Client**:
    ```bash
    pnpm prisma:generate
    ```
5.  **Run Development Server**:
    ```bash
    pnpm dev
    ```

---

## 6. Running with Docker (Quickest)

If you prefer using Docker, you can start everything (except the Ollama service) with one command from the project root:
```bash
docker-compose up --build
```
*Note: You still need Ollama running on your host machine for the backend to connect to it via `host.docker.internal` or your local IP.*

---

## Troubleshooting

- **Ollama Connection Refused**: Ensure `ollama serve` is running and the `OLLAMA_BASE_URL` in `backend/.env` is accessible.
- **Model Not Found**: Make sure you have run `ollama pull <model_name>` for the exact model specified in your `.env`.
- **Prisma Errors**: Ensure `DATABASE_URL` is correct and PostgreSQL is accepting connections.

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.session import connect_db, disconnect_db
from app.api.routes import auth, analyze, resumes, candidates, gmail

app = FastAPI(
    title="AI HR Copilot API",
    description="Backend for production-ready AI-powered HR application",
    version="1.0.0"
)

# CORS configuration
origins = [
    "http://localhost:3000",
    "https://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lifecycle events
@app.on_event("startup")
async def on_startup():
    await connect_db()

@app.on_event("shutdown")
async def on_shutdown():
    await disconnect_db()

# Main app routes
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["resumes"])
app.include_router(analyze.router, prefix="/api/analyze", tags=["analyze"])
app.include_router(candidates.router, prefix="/api/candidates", tags=["candidates"])
app.include_router(gmail.router, prefix="/api/gmail", tags=["gmail"])

@app.get("/")
def read_root():
    return {"message": "Welcome to AI HR Copilot API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

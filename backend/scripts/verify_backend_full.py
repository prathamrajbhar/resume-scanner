import asyncio
import httpx
import os
import sys
import json
from pathlib import Path

# Add backend to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.security import create_access_token

BASE_URL = "http://localhost:8000"
TEST_USER_ID = "da031c1b-e721-4966-80e9-21c5dc58c7c4"
RESUME_PATH = "/disk1/temp/resume-scanner/testing_data/Resume - Excellent.pdf"

async def check_ollama():
    print("Checking Ollama status...")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            if resp.status_code == 200:
                print("SUCCESS: Ollama is running.")
                models = [m['name'] for m in resp.json().get('models', [])]
                print(f"Available models: {models}")
                return True
            else:
                print(f"WARNING: Ollama returned {resp.status_code}")
                return False
    except Exception as e:
        print(f"ERROR: Ollama connection failed: {e}")
        return False

async def verify_backend():
    if not await check_ollama():
        print("STOPPING: Ollama is essential for backend functionality.")
        return

    # 1. Generate Token
    token = create_access_token(subject=TEST_USER_ID)
    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=300.0) as client:
        print("\n--- Phase 1: Authentication ---")
        print("Checking /api/users/me...")
        try:
            resp = await client.get("/api/users/me", headers=headers)
            if resp.status_code != 200:
                print(f"FAILED: /api/users/me returned {resp.status_code}: {resp.text}")
                return
            print(f"SUCCESS: Authenticated as {resp.json().get('email')}")
        except Exception as e:
            print(f"FAILED: Could not connect to API at {BASE_URL}. Is uvicorn running?")
            return

        print("\n--- Phase 2: Job Role Management ---")
        print("Creating a test Job Role...")
        job_payload = {
            "title": "Full Stack Developer (Verify Test)",
            "description": "Automated verification test job",
            "skills": [
                {"skill_name": "Python", "level": "advanced"},
                {"skill_name": "React", "level": "intermediate"}
            ],
            "auto_select_enabled": True,
            "auto_select_threshold": 80,
            "require_hr_confirmation": True
        }
        resp = await client.post("/api/jobs/", json=job_payload, headers=headers)
        if resp.status_code != 200:
            print(f"FAILED: /api/jobs/ returned {resp.status_code}: {resp.text}")
            return
        job_data = resp.json()
        job_id = job_data["id"]
        print(f"SUCCESS: Job Role created with ID: {job_id}")

        print("\n--- Phase 3: Resume Upload ---")
        if not os.path.exists(RESUME_PATH):
            print(f"WARNING: Specific test file missing at {RESUME_PATH}. Searching testing_data...")
            import glob
            pdfs = glob.glob("/disk1/temp/resume-scanner/testing_data/*.pdf")
            if not pdfs:
                print("FAILED: No PDF files found in testing_data.")
                return
            RESUME_PATH_FINAL = pdfs[0]
        else:
            RESUME_PATH_FINAL = RESUME_PATH
            
        print(f"Uploading resume: {os.path.basename(RESUME_PATH_FINAL)}...")
        with open(RESUME_PATH_FINAL, "rb") as f:
            files = {"file": (os.path.basename(RESUME_PATH_FINAL), f, "application/pdf")}
            resp = await client.post("/api/resumes/upload", files=files, headers=headers)
            
        if resp.status_code != 200:
            print(f"FAILED: /api/resumes/upload returned {resp.status_code}: {resp.text}")
            return
        resume_data = resp.json()
        resume_id = resume_data["candidate_id"] # The response schema says candidate_id
        print(f"SUCCESS: Resume uploaded. Candidate ID: {resume_id}")

        print("\n--- Phase 4: AI Analysis ---")
        print("Triggering Analysis for uploaded resume...")
        analysis_payload = {
            "job_id": job_id,
            "resume_ids": [resume_id]
        }
        resp = await client.post("/api/analysis/", json=analysis_payload, headers=headers)
        if resp.status_code != 200:
            print(f"FAILED: /api/analysis/ returned {resp.status_code}: {resp.text}")
            return
        
        analysis_results = resp.json()
        print(f"SUCCESS: Analysis completed. Received {len(analysis_results)} results.")
        if analysis_results:
            first = analysis_results[0]
            print(f"  Match Score: {first.get('match_score')}%")
            print(f"  Candidate Name: {first.get('candidate_name')}")

        print("\n--- Phase 5: Verification ---")
        print("Fetching candidates list...")
        resp = await client.get("/api/candidates/", headers=headers)
        if resp.status_code == 200:
            candidates = resp.json()
            print(f"SUCCESS: Total candidates found: {len(candidates)}")
        else:
            print(f"WARNING: /api/candidates/ returned {resp.status_code}")

        print("\n--- Phase 6: Cleanup ---")
        print(f"Deleting test job role {job_id}...")
        resp = await client.delete(f"/api/jobs/{job_id}", headers=headers)
        if resp.status_code in [200, 204]:
            print("SUCCESS: Test Job Role deleted.")
        else:
            print(f"WARNING: Failed to delete test job role: {resp.status_code}")

        print("\n============================================")
        print("   ALL BACKEND CHECKS PASSED SUCCESSFULLY   ")
        print("============================================")

if __name__ == "__main__":
    asyncio.run(verify_backend())

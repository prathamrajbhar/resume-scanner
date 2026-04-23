# Resume Scanner - Usage Guide

This guide explains how to effectively use the Resume Scanner application to manage, screen, and analyze candidates.

## 🚀 Getting Started

Once the application is running:
1.  Navigate to `http://localhost:3000`.
2.  Log in using your credentials (or create an account if registration is enabled).
3.  You will be greeted by the **Dashboard**, which shows an overview of your recruitment pipeline.

---

## 📁 Managing Resumes

### Uploading Resumes
- Go to the **Upload** page from the sidebar.
- Drag and drop your resume files (PDF or DOCX) into the upload zone.
- Click **Process** to let the AI (Ollama) parse the candidate information.
- Once processed, candidates will appear in your main candidate list.

### Syncing from Gmail
- Navigate to the **Gmail** integration page.
- Connect your account to automatically fetch resumes from specific email threads or labels.
- The system will scan your inbox for attachments and import them into the scanner.

---

## 📋 Screening & Analysis

### Candidate List
- The **Candidates** page displays all imported resumes.
- View high-level scores and key skills for each applicant at a glance.

### Deep Analysis
- Click on any candidate to open their **Detailed View**.
- Here you can see:
    - **Extracted Profile**: Contact info, education, and experience parsed by AI.
    - **Score Breakdown**: How they match specific job requirements.
    - **Skill Visualization**: A breakdown of technical and soft skills.

### Job Role Matching
- Use the **Analyze** feature to compare a candidate against a specific Job Description (JD).
- Provide the JD text, and the AI will generate a fitment score (0-100) and an explanation of the match.

---

## 💬 AI HR Copilot (Chatbase)

The **Chatbase** feature allows you to interact with your candidate database using natural language.
- Ask questions like: *"Which candidates have experience with React and Node.js?"*
- Provide a job summary and ask: *"Who is the best fit for this Senior Developer role?"*
- Get qualitative summaries: *"Summarize John Doe's leadership experience."*

---

## 📊 Comparing Candidates

- Select multiple candidates from the list.
- Use the **Compare** tool to see a side-by-side visualization of their scores and skills.
- This helps you make data-driven decisions during the final selection process.

---

## ⚙️ Settings & Customization

- **Models**: The application uses local models via Ollama. You can verify the active model in the backend settings.
- **Storage**: All uploaded resumes are securely stored in your configured Google Drive for easy access by the entire HR team.

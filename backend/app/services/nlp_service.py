import os
import io
import re
import logging
import pandas as pd
import fitz  # PyMuPDF
from typing import List, Dict, Set, Tuple, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Skill Dictionary (from NLP-G1) ---
SKILL_DICTIONARY = {
    'python': ['python', 'py'],
    'java': ['java'],
    'javascript': ['javascript', 'js', 'node.js', 'nodejs', 'react', 'next.js'],
    'sql': ['sql', 'postgresql', 'mysql', 'mongodb'],
    'machine learning': ['machine learning', 'ml', 'deep learning', 'nlp'],
    'aws': ['aws', 'amazon web services', 'cloud'],
    'docker': ['docker', 'kubernetes'],
    # ... can be expanded
}

class NLPService:
    _bert_model = None

    @classmethod
    def get_bert_model(cls):
        if cls._bert_model is None:
            logger.info("Loading BERT model...")
            cls._bert_model = SentenceTransformer('all-MiniLM-L6-v2')
        return cls._bert_model

    def extract_text_from_bytes(self, content: bytes, filename: str) -> str:
        """Extracts text from various file formats."""
        ext = filename.split('.')[-1].lower()
        text = ""
        
        try:
            if ext == 'pdf':
                doc = fitz.open(stream=content, filetype="pdf")
                for page in doc:
                    text += page.get_text()
                doc.close()
            elif ext in ['doc', 'docx']:
                try:
                    import docx
                    doc = docx.Document(io.BytesIO(content))
                    text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
                except ImportError:
                    logger.warning("python-docx not found, falling back to placeholder")
                    text = "DOCX extraction placeholder"
                except Exception as e:
                    logger.error(f"Error parsing DOCX: {e}")
                    text = ""
            elif ext in ['csv']:
                df = pd.read_csv(io.BytesIO(content))
                text = df.to_string()
            elif ext in ['xlsx', 'xls']:
                df = pd.read_excel(io.BytesIO(content))
                text = df.to_string()
            else:
                text = content.decode('utf-8', errors='ignore')
        except Exception as e:
            logger.error(f"Error extracting text from {filename}: {e}")
            
        return text.strip()

    def extract_skills(self, text: str) -> Set[str]:
        text_lower = text.lower()
        detected = set()
        for skill, variations in SKILL_DICTIONARY.items():
            for var in variations:
                if re.search(r'\b' + re.escape(var) + r'\b', text_lower):
                    detected.add(skill)
                    break
        return detected

    def extract_candidate_name(self, text: str, filename: str = "") -> Optional[str]:
        """
        Best-effort candidate name extraction.
        Strategy:
        1) Prefer first meaningful line in resume text.
        2) Fall back to filename-derived name.
        """
        lines = [line.strip() for line in text.splitlines() if line and line.strip()]
        name_stopwords = {
            'resume', 'curriculum', 'vitae', 'email', 'phone', 'contact', 'summary',
            'objective', 'skills', 'education', 'experience', 'projects', 'linkedin',
        }

        for line in lines[:12]:
            compact = re.sub(r'\s+', ' ', line).strip()
            if len(compact) < 3 or len(compact) > 60:
                continue
            if any(ch.isdigit() for ch in compact):
                continue
            if '@' in compact:
                continue

            words = [w for w in re.split(r'\s+', compact) if w]
            if not (2 <= len(words) <= 4):
                continue

            lowered_words = {w.lower() for w in words}
            if lowered_words & name_stopwords:
                continue

            # Keep only alphabetic-ish names like "John Dsouza".
            if all(re.fullmatch(r"[A-Za-z][A-Za-z'.-]*", w) for w in words):
                return ' '.join(w.capitalize() for w in words)

        stem = filename.rsplit('.', 1)[0] if filename else ''
        cleaned = re.sub(r'[_\-]+', ' ', stem).strip()
        if cleaned:
            tokens = [t for t in cleaned.split() if t]
            if 1 <= len(tokens) <= 5:
                return ' '.join(token.capitalize() for token in tokens)

        return None

    def extract_candidate_profile(self, text: str, filename: str = "") -> Dict:
        email_match = re.search(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', text)
        phone_match = re.search(r'(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{4}', text)

        return {
            'full_name': self.extract_candidate_name(text, filename),
            'email': email_match.group(0) if email_match else None,
            'phone': phone_match.group(0) if phone_match else None,
            'location': None,
            'skills': sorted(list(self.extract_skills(text))),
            'total_experience': None,
            'education': None,
        }

    def score_tfidf(self, resume_text: str, job_description: str) -> float:
        if not resume_text or not job_description: return 0.0
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf = vectorizer.fit_transform([resume_text, job_description])
        return float(cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0])

    def score_bert(self, resume_text: str, job_description: str) -> float:
        model = self.get_bert_model()
        embeddings = model.encode([resume_text, job_description])
        return float(cosine_similarity([embeddings[0]], [embeddings[1]])[0][0])

    def analyze_candidate(self, resume_text: str, job_description: str, model_type: str = "ensemble") -> Dict:
        """Ranks a single candidate against a job description."""
        
        # Extract skills
        resume_skills = self.extract_skills(resume_text)
        job_skills = self.extract_skills(job_description)
        
        # Skill match
        matching = job_skills & resume_skills
        missing = job_skills - resume_skills
        skill_score = len(matching) / len(job_skills) if job_skills else 1.0
        
        # Model scores
        tfidf_score = self.score_tfidf(resume_text, job_description)
        bert_score = self.score_bert(resume_text, job_description)
        
        # Ensemble calculation (Hybrid weight example)
        # Final = (0.4 * BERT) + (0.3 * TF-IDF) + (0.3 * Skill Score)
        ensemble_score = (0.4 * bert_score) + (0.3 * tfidf_score) + (0.3 * skill_score)
        
        # Select result based on model_type
        if model_type == "bert":
            final_score = bert_score
        elif model_type == "tf-idf":
            final_score = tfidf_score
        elif model_type == "hybrid":
            final_score = (bert_score + tfidf_score) / 2
        else: # deep ensemble
            final_score = ensemble_score
            
        return {
            "score": round(final_score * 100, 2),
            "breakdown": {
                "bert": round(bert_score * 100, 2),
                "tfidf": round(tfidf_score * 100, 2),
                "skills": round(skill_score * 100, 2)
            },
            "skills": list(resume_skills),
            "matching_skills": list(matching),
            "missing_skills": list(missing)
        }

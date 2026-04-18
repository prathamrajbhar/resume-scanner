import os
import io
import re
import logging
import string
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

PROFILE_SECTION_STOP_WORDS = {
    'education', 'experience', 'projects', 'project', 'certifications', 'certification',
    'summary', 'objective', 'achievements', 'work history', 'employment',
    'internships', 'internship', 'contact', 'profile', 'languages',
    'personal information', 'declaration', 'references', 'hobbies', 'interests',
}

SECTION_STOP_PREFIXES = {
    'education', 'experience', 'projects', 'project', 'certifications', 'certification',
    'summary', 'objective', 'achievements', 'awards', 'work history', 'employment',
    'internships', 'internship', 'contact', 'profile', 'languages',
    'personal information', 'declaration', 'references', 'hobbies', 'interests',
}

SKILL_SECTION_HEADERS = {
    'skills', 'technical skills', 'core skills', 'key skills', 'competencies',
    'skill summary', 'areas of expertise',
}

SKILL_ALIASES = {
    'ms excel': 'microsoft excel',
    'excel': 'microsoft excel',
    'microsoft excel': 'microsoft excel',
    'ms word': 'microsoft word',
    'word': 'microsoft word',
    'microsoft word': 'microsoft word',
    'ms office': 'microsoft office',
    'microsoft office': 'microsoft office',
    'powerpoint': 'microsoft powerpoint',
    'ms powerpoint': 'microsoft powerpoint',
    'microsoft powerpoint': 'microsoft powerpoint',
}

SKILL_SYNONYMS = {
    'cybersecurity protocols': 'cybersecurity',
    'problem-solving': 'problem solving',
    'problem solving': 'problem solving',
    'communication skills': 'communication',
}

GROUPED_SKILL_PREFIXES = {
    'microsoft office': 'microsoft',
    'ms office': 'microsoft',
    'office': 'microsoft',
}

GROUPED_SKILL_QUALIFIERS = {
    'advanced', 'beginner', 'basic', 'intermediate', 'expert', 'proficient',
    'strong', 'good', 'excellent', 'hands on',
}

SOFT_SKILL_KEYWORDS = {
    'communication': ['communication', 'presentation', 'verbal', 'written communication'],
    'leadership': ['leadership', 'led', 'managed teams', 'mentoring'],
    'teamwork': ['teamwork', 'collaboration', 'cross-functional'],
    'problem solving': ['problem solving', 'troubleshooting', 'root cause', 'analytical thinking'],
    'adaptability': ['adaptability', 'adaptable', 'flexible', 'quick learner'],
}

class NLPService:
    _bert_model = None

    @staticmethod
    def _normalize_text_token(value: str) -> str:
        lowered = (value or '').strip().lower()
        lowered = re.sub(rf'[{re.escape(string.punctuation)}]', ' ', lowered)
        return re.sub(r'\s+', ' ', lowered).strip()

    @classmethod
    def normalize_skill_name(cls, value: str) -> str:
        normalized = cls._normalize_text_token(value)
        if not normalized:
            return ''
        normalized = SKILL_ALIASES.get(normalized, normalized)
        return SKILL_SYNONYMS.get(normalized, normalized)

    def normalize_skills(self, skills: List[str] | Set[str]) -> List[str]:
        normalized = [self.normalize_skill_name(skill) for skill in skills]
        return sorted(list({skill for skill in normalized if skill}))

    def _expand_grouped_skills(self, text: str) -> Set[str]:
        expanded: Set[str] = set()
        if not text:
            return expanded

        for match in re.finditer(r'([A-Za-z][A-Za-z\s&./+-]{1,40})\(([^\)]+)\)', text):
            prefix_raw = match.group(1)
            grouped_raw = match.group(2)
            prefix = self.normalize_skill_name(prefix_raw)
            if not prefix or not grouped_raw:
                continue

            grouped_tokens = [segment.strip() for segment in re.split(r'[,;/|]', grouped_raw) if segment.strip()]
            if not grouped_tokens:
                continue

            prefix_replacement = GROUPED_SKILL_PREFIXES.get(prefix)
            for token in grouped_tokens:
                normalized_token = self.normalize_skill_name(token)
                if not normalized_token:
                    continue

                token_parts = [part for part in normalized_token.split(' ') if part]
                if token_parts and token_parts[0] in GROUPED_SKILL_QUALIFIERS and len(token_parts) > 1:
                    normalized_token = self.normalize_skill_name(' '.join(token_parts[1:]))
                    if not normalized_token:
                        continue

                if prefix_replacement and not normalized_token.startswith(prefix_replacement):
                    expanded.add(self.normalize_skill_name(f'{prefix_replacement} {normalized_token}'))
                else:
                    expanded.add(normalized_token)

        return expanded

    def _scan_resume_for_additional_skills(self, text: str) -> Set[str]:
        if not text:
            return set()

        normalized_text = self._normalize_text_token(text)
        found: Set[str] = set()

        for raw_term, canonical in SKILL_SYNONYMS.items():
            term = self._normalize_text_token(raw_term)
            if term and term in normalized_text:
                found.add(self.normalize_skill_name(canonical))

        # Scan full resume content instead of only one section block.
        for token in list(SKILL_ALIASES.keys()) + list(SKILL_ALIASES.values()):
            normalized = self.normalize_skill_name(token)
            if normalized and normalized in normalized_text:
                found.add(normalized)

        for soft_skill, hints in SOFT_SKILL_KEYWORDS.items():
            for hint in hints:
                normalized_hint = self.normalize_skill_name(hint)
                if normalized_hint and normalized_hint in normalized_text:
                    found.add(self.normalize_skill_name(soft_skill))
                    break

        found.update(self._expand_grouped_skills(text))
        return found

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

        # Keep dictionary hits but enrich with section parsing and full resume scanning.
        detected.update(self._extract_skills_from_section(text))
        detected.update(self._scan_resume_for_additional_skills(text))
        return set(self.normalize_skills(list(detected)))

    def extract_soft_skills(self, text: str) -> List[str]:
        text_lower = (text or '').lower()
        found = []
        for soft_skill, tokens in SOFT_SKILL_KEYWORDS.items():
            if any(token in text_lower for token in tokens):
                found.append(soft_skill)
        return sorted(found)

    def extract_projects_count(self, text: str) -> int:
        lines = [line.strip() for line in (text or '').splitlines() if line and line.strip()]
        project_section_start = -1
        for idx, line in enumerate(lines[:250]):
            cleaned = re.sub(r'[:\-]+$', '', line.lower()).strip()
            if cleaned in {'projects', 'project experience', 'academic projects', 'key projects'}:
                project_section_start = idx + 1
                break

        if project_section_start == -1:
            # Fallback: count bullet lines with common project indicators.
            indicator_hits = sum(
                1
                for line in lines
                if re.search(r'\b(project|developed|built|implemented)\b', line.lower())
            )
            return min(indicator_hits, 12)

        count = 0
        for line in lines[project_section_start:project_section_start + 60]:
            lowered = line.lower().strip()
            if not lowered:
                continue
            if lowered in PROFILE_SECTION_STOP_WORDS:
                break
            if re.match(r'^[-*\u2022]\s+', line) or re.match(r'^\d+[\.)]\s+', line):
                count += 1
                continue
            if len(line.split()) <= 8:
                count += 1

        return min(count, 12)

    def _extract_section_lines(self, text: str, headers: Set[str], max_lines: int = 40) -> List[str]:
        lines = [line.strip() for line in (text or '').splitlines() if line and line.strip()]
        if not lines:
            return []

        start_idx = -1
        for idx, line in enumerate(lines[:250]):
            cleaned = re.sub(r'[:\-]+$', '', line.lower()).strip()
            if cleaned in headers:
                start_idx = idx + 1
                break

        if start_idx == -1:
            return []

        collected: List[str] = []
        for line in lines[start_idx:start_idx + max_lines]:
            lowered = re.sub(r'[:\-]+$', '', line.lower()).strip()
            if lowered in PROFILE_SECTION_STOP_WORDS:
                break
            # Also stop on heading-like lines such as "Education Details" or "Projects:"
            normalized_heading = re.sub(r'[^a-z\s]', ' ', lowered)
            normalized_heading = re.sub(r'\s+', ' ', normalized_heading).strip()
            if any(
                normalized_heading == stop_word or normalized_heading.startswith(f"{stop_word} ")
                for stop_word in SECTION_STOP_PREFIXES
            ):
                break
            collected.append(line)

        return collected

    def _collapse_section_entries(self, lines: List[str], max_entries: int = 20, max_len: int = 260) -> List[str]:
        def _is_list_item_start(value: str) -> bool:
            return bool(re.match(r'^\s*(?:[-*\u2022]|\d+[\.)]|[A-Za-z][\.)])\s+', value or ''))

        entries: List[str] = []
        for raw_line in lines:
            line = re.sub(r'\s+', ' ', (raw_line or '').strip())
            if not line:
                continue

            line_without_marker = re.sub(r'^\s*(?:[-*\u2022]|\d+[\.)]|[A-Za-z][\.)])\s*', '', line).strip()
            if not line_without_marker:
                continue

            if not entries:
                entries.append(line_without_marker)
                continue

            if _is_list_item_start(line):
                entries.append(line_without_marker)
                if len(entries) >= max_entries:
                    break
                continue

            previous = entries[-1]
            previous_has_open_paren = previous.count('(') > previous.count(')')
            previous_ends_sentence = bool(re.search(r'[.!?;:]\s*$', previous))
            looks_like_continuation = previous_has_open_paren or not previous_ends_sentence

            if looks_like_continuation and len(previous) + len(line_without_marker) + 1 <= max_len:
                entries[-1] = f"{previous} {line_without_marker}".strip()
            else:
                entries.append(line_without_marker)

            if len(entries) >= max_entries:
                break

        return entries

    def _extract_degrees(self, text: str) -> List[Dict[str, Optional[float] | Optional[str]]]:
        degree_pattern = re.compile(
            r'((?:bachelor|master|phd|doctorate|diploma|b\.tech|b\.?\s*tech|b\.e|be|bsc|b\.sc|bs|m\.tech|m\.?\s*tech|m\.e|me|msc|m\.sc|ms|mba|pgdm)[^\n,;]{0,90})',
            re.IGNORECASE,
        )
        field_pattern = re.compile(r'\b(?:in|of)\s+([A-Za-z][A-Za-z\s&/-]{2,60})', re.IGNORECASE)
        cgpa_pattern = re.compile(r'(?:cgpa|gpa)\s*[:\-]?\s*([0-9](?:\.[0-9]+)?)', re.IGNORECASE)
        college_pattern = re.compile(r'([A-Z][A-Za-z\s&\-.]{3,}(?:University|Institute|College))')

        lines = [line.strip() for line in (text or '').splitlines() if line and line.strip()]
        entries: List[Dict[str, Optional[float] | Optional[str]]] = []
        seen: Set[str] = set()

        for idx, line in enumerate(lines):
            degree_match = degree_pattern.search(line)
            if not degree_match:
                continue

            degree_text = re.sub(r'\s+', ' ', degree_match.group(1)).strip()
            normalized_degree = degree_text.lower()
            has_supported_degree = bool(
                re.search(
                    r'\b(mba|pgdm|phd|doctorate|master|bachelor|m\.\s*tech|b\.\s*tech|m\.\s*e|b\.\s*e|m\.\s*sc|b\.\s*sc|msc|bsc|master of|bachelor of)\b',
                    normalized_degree,
                )
            )
            has_invalid_token = bool(re.search(r'\b(ms office|microsoft office|sharepoint|tools?)\b', normalized_degree))
            if not has_supported_degree or has_invalid_token:
                continue

            field_match = field_pattern.search(line)
            field_text = re.sub(r'\s+', ' ', field_match.group(1)).strip() if field_match else None
            detail_line = lines[idx + 1] if idx + 1 < len(lines) else ''
            college_match = college_pattern.search(detail_line) or college_pattern.search(line)
            college_text = re.sub(r'\s+', ' ', college_match.group(1)).strip() if college_match else None

            location_text: Optional[str] = None
            if detail_line and '|' in detail_line:
                parts = [part.strip() for part in detail_line.split('|') if part.strip()]
                for part in parts:
                    lowered_part = part.lower()
                    if college_text and college_text.lower() in lowered_part:
                        continue
                    if len(part.split()) <= 10 and re.search(r'[A-Za-z]', part):
                        location_text = part
                        break

            cgpa_value: Optional[float] = None
            for look_ahead in (line, lines[idx + 1] if idx + 1 < len(lines) else ''):
                cgpa_match = cgpa_pattern.search(look_ahead)
                if cgpa_match:
                    try:
                        parsed = float(cgpa_match.group(1))
                        cgpa_value = parsed if parsed <= 10 else min(parsed / 10.0, 10.0)
                        break
                    except ValueError:
                        pass

            dedupe_key = f"{degree_text.lower()}::{(field_text or '').lower()}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            entries.append({
                'degree': degree_text,
                'field': field_text,
                'cgpa': cgpa_value,
                'college': college_text,
                'location': location_text,
            })

            if len(entries) >= 6:
                break

        return entries

    def _extract_experience_list(self, text: str) -> List[Dict[str, str]]:
        lines = [line.strip() for line in (text or '').splitlines() if line and line.strip()]
        entries: List[Dict[str, str]] = []
        seen: Set[str] = set()

        duration_pattern = re.compile(
            r'((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)?\s*\d{4}\s*(?:-|to|–)\s*(?:present|current|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)?\s*\d{4})|\d+(?:\.\d+)?\s*(?:years?|yrs?))',
            re.IGNORECASE,
        )
        role_hint_pattern = re.compile(r'\b(engineer|developer|analyst|manager|consultant|intern|designer|architect|lead|specialist)\b', re.IGNORECASE)

        for line in lines:
            duration_match = duration_pattern.search(line)
            if not duration_match and not role_hint_pattern.search(line):
                continue

            cleaned = re.sub(r'^\s*(?:[-*]|\d+[\.)])\s*', '', line).strip()
            if not cleaned or len(cleaned) > 160:
                continue

            duration = duration_match.group(1).strip() if duration_match else ''
            role = cleaned
            if duration:
                role = cleaned.replace(duration, '').strip(' -|,') or cleaned

            dedupe_key = f"{role.lower()}::{duration.lower()}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            entries.append({
                'role': role,
                'duration': duration,
            })

            if len(entries) >= 8:
                break

        return entries

    def _extract_projects_list(self, text: str) -> List[str]:
        section_lines = self._extract_section_lines(
            text,
            {'projects', 'project experience', 'academic projects', 'key projects'},
            max_lines=60,
        )

        source_lines = section_lines if section_lines else [line.strip() for line in (text or '').splitlines() if line and line.strip()]
        projects: List[str] = []
        seen: Set[str] = set()

        for line in source_lines:
            cleaned = re.sub(r'^\s*(?:[-*]|\d+[\.)])\s*', '', line).strip()
            lowered = cleaned.lower()
            if not cleaned:
                continue

            if re.search(r'\b(personal information|date of birth|nationality|marital|gender|address|contact|email|phone)\b', lowered):
                continue
            if section_lines and re.fullmatch(r'[A-Z][A-Z\s&]{3,}', cleaned):
                break
            if len(cleaned.split()) <= 1:
                continue
            if len(cleaned.split()) > 24:
                continue
            if not section_lines and not re.search(r'\b(project|developed|built|implemented|designed)\b', lowered):
                continue

            key = lowered
            if key in seen:
                continue
            seen.add(key)
            projects.append(cleaned)

            if len(projects) >= 12:
                break

        return projects

    def _extract_certifications(self, text: str) -> List[str]:
        section_lines = self._extract_section_lines(
            text,
            {'certifications', 'certification', 'licenses'},
            max_lines=40,
        )
        source_lines = (
            self._collapse_section_entries(section_lines, max_entries=20, max_len=220)
            if section_lines
            else [line.strip() for line in (text or '').splitlines() if line and line.strip()]
        )

        certs: List[str] = []
        seen: Set[str] = set()
        for line in source_lines:
            cleaned = re.sub(r'^\s*(?:[-*]|\d+[\.)])\s*', '', line).strip()
            lowered = cleaned.lower()
            if not cleaned:
                continue
            if not section_lines and not re.search(r'\b(certified|certification|certificate|aws|azure|gcp|scrum|pmp)\b', lowered):
                continue
            if re.search(r'\b(mba|master|bachelor|m\.?\s*sc|b\.?\s*sc|m\.?\s*tech|b\.?\s*tech|phd|doctorate|university|college|institute|cgpa|sgpa)\b', lowered):
                continue
            if re.search(r'\b(kolkata|meerut|uttar pradesh|west bengal)\b', lowered):
                continue
            if len(cleaned) > 220:
                continue

            if lowered in seen:
                continue
            seen.add(lowered)
            certs.append(cleaned)

            if len(certs) >= 10:
                break

        return certs

    def _extract_awards(self, text: str) -> List[str]:
        section_lines = self._extract_section_lines(
            text,
            {'awards', 'award', 'achievements', 'honors', 'honours', 'accomplishments'},
            max_lines=40,
        )
        source_lines = (
            self._collapse_section_entries(section_lines, max_entries=20, max_len=260)
            if section_lines
            else [line.strip() for line in (text or '').splitlines() if line and line.strip()]
        )

        awards: List[str] = []
        seen: Set[str] = set()
        for line in source_lines:
            cleaned = re.sub(r'^\s*(?:[-*]|\d+[\.)])\s*', '', line).strip()
            lowered = cleaned.lower()
            if not cleaned:
                continue

            if not section_lines and not re.search(r'\b(award|awarded|winner|won|recognition|honou?r|achievement|accomplishment|medal)\b', lowered):
                continue
            if len(cleaned) > 260:
                continue
            if re.search(r'\b(certification|certificate|certified|license|licensed)\b', lowered):
                continue

            if lowered in seen:
                continue
            seen.add(lowered)
            awards.append(cleaned)

            if len(awards) >= 10:
                break

        return awards

    def _extract_skills_from_section(self, text: str) -> Set[str]:
        lines = [line.strip() for line in text.splitlines() if line and line.strip()]
        if not lines:
            return set()

        start_idx = -1
        for idx, line in enumerate(lines[:120]):
            cleaned = re.sub(r'[:\-]+$', '', line.lower()).strip()
            if cleaned in SKILL_SECTION_HEADERS:
                start_idx = idx + 1
                break

        if start_idx == -1:
            return set()

        collected: List[str] = []
        for line in lines[start_idx:start_idx + 30]:
            lowered = line.lower().strip()
            lowered_no_trailer = re.sub(r'[:\-]+$', '', lowered).strip()
            if lowered_no_trailer in PROFILE_SECTION_STOP_WORDS:
                break

            # Stop when a likely section heading appears.
            if re.fullmatch(r'[A-Za-z][A-Za-z\s&/]{2,40}', line.strip()):
                heading_candidate = line.strip().lower()
                if heading_candidate in PROFILE_SECTION_STOP_WORDS:
                    break

            normalized = re.sub(r'^\s*\d+[\.)]\s*', '', line)
            normalized = re.sub(r'^\s*[-*]+\s*', '', normalized).strip()
            if not normalized:
                continue

            fragments = re.split(r'[,;|]', normalized)
            for fragment in fragments:
                token = fragment.strip().strip('.').strip()
                if not token:
                    continue
                # Remove category prefixes like "Soft Skills: Communication".
                if ':' in token:
                    left, right = token.split(':', 1)
                    left = left.strip()
                    right = right.strip()
                    if left:
                        collected.append(left)
                    if right:
                        collected.append(right)
                    continue
                collected.append(token)

        cleaned_skills: Dict[str, str] = {}
        for token in collected:
            normalized = re.sub(r'\s+', ' ', token).strip().lower()
            if len(normalized) < 2 or len(normalized) > 50:
                continue
            if '@' in normalized:
                continue
            if re.fullmatch(r'\d+(?:\.\d+)?', normalized):
                continue
            if normalized in PROFILE_SECTION_STOP_WORDS:
                continue
            # Ignore sentence-like fragments that are unlikely to be a skill token.
            if len(normalized.split()) > 7:
                continue
            cleaned_skills[normalized] = normalized

        return set(cleaned_skills.values())

    def extract_location(self, text: str) -> Optional[str]:
        def _clean_location_value(value: str) -> Optional[str]:
            cleaned = re.sub(r'\s+', ' ', value).strip(' ,;:-')
            if not cleaned:
                return None
            if len(cleaned) < 4 or len(cleaned) > 140:
                return None
            if '@' in cleaned:
                return None
            return cleaned

        labeled_match = re.search(
            r'(?im)^(?:current\s+location|location|address)\s*[:\-]\s*(.+)$',
            text,
        )
        if labeled_match:
            cleaned = _clean_location_value(labeled_match.group(1))
            if cleaned:
                return cleaned

        lines = [line.strip() for line in text.splitlines() if line and line.strip()]
        for line in lines[:80]:
            lowered = line.lower()
            if '@' in line:
                continue
            if re.search(r'\b(?:linkedin|github|portfolio)\b', lowered):
                continue
            if re.search(r'\+?\d[\d\s\-]{7,}', line):
                continue

            has_postal = bool(re.search(r'\b\d{6}\b', line))
            has_address_word = bool(
                re.search(
                    r'\b(?:road|rd|street|st|lane|ln|avenue|ave|apartment|apt|city|state|district|nagar|colony)\b',
                    lowered,
                )
            )
            has_comma = ',' in line

            if (has_postal and (has_comma or has_address_word)) or (has_address_word and has_comma):
                cleaned = _clean_location_value(line)
                if cleaned:
                    return cleaned

        return None

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
        def _to_float(value: Optional[str]) -> Optional[float]:
            if not value:
                return None
            try:
                return float(value)
            except ValueError:
                return None

        def _extract_cgpa(input_text: str) -> Optional[float]:
            match = re.search(r'(?:cgpa|gpa)\s*[:\-]?\s*([0-9](?:\.[0-9]+)?)', input_text, re.IGNORECASE)
            if not match:
                return None
            value = _to_float(match.group(1))
            if value is None:
                return None
            return value if value <= 10 else min(value / 10.0, 10.0)

        def _extract_sgpa(input_text: str) -> Optional[float]:
            match = re.search(r'(?:sgpa)\s*[:\-]?\s*([0-9](?:\.[0-9]+)?)', input_text, re.IGNORECASE)
            if not match:
                return None
            value = _to_float(match.group(1))
            if value is None:
                return None
            return value if value <= 10 else min(value / 10.0, 10.0)

        def _extract_total_experience(input_text: str) -> Optional[float]:
            match = re.search(r'(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)', input_text, re.IGNORECASE)
            if not match:
                return None
            value = _to_float(match.group(1))
            return value if value is not None else None

        def _extract_degree(input_text: str) -> Optional[str]:
            match = re.search(
                r'((?:bachelor|master|phd|doctorate|diploma|b\.tech|b\.e|bsc|bs|m\.tech|m\.e|msc|ms)[^\n,;]{0,60})',
                input_text,
                re.IGNORECASE,
            )
            return match.group(1).strip() if match else None

        def _extract_university(input_text: str) -> Optional[str]:
            match = re.search(r'([A-Z][A-Za-z\s&\-.]{3,}(?:University|Institute|College))', input_text)
            return match.group(1).strip() if match else None

        def _extract_internships(input_text: str) -> List[str]:
            lines = [line.strip() for line in input_text.splitlines() if line.strip()]
            internships: List[str] = []
            for line in lines:
                lowered = line.lower()
                if 'intern' in lowered:
                    internships.append(line)
                if len(internships) >= 5:
                    break
            return internships

        email_match = re.search(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', text)
        phone_match = re.search(r'(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{4}', text)
        normalized_skills = self.normalize_skills(list(self.extract_skills(text)))
        soft_skills = self.extract_soft_skills(text)
        projects = self._extract_projects_list(text)
        projects_count = len(projects) if projects else self.extract_projects_count(text)
        total_experience_years = _extract_total_experience(text)
        experience_list = self._extract_experience_list(text)
        degrees = self._extract_degrees(text)
        certifications = self._extract_certifications(text)
        awards = self._extract_awards(text)
        degree = _extract_degree(text)
        cgpa_value = _extract_cgpa(text)

        percentage_match = re.search(r'([0-9]{2}(?:\.[0-9]+)?)\s*%', text)
        percentage_value = _to_float(percentage_match.group(1)) if percentage_match else None
        cgpa_or_percentage = cgpa_value if cgpa_value is not None else percentage_value

        return {
            'full_name': self.extract_candidate_name(text, filename),
            'email': email_match.group(0) if email_match else None,
            'phone': phone_match.group(0) if phone_match else None,
            'location': self.extract_location(text),
            'skills': normalized_skills,
            'normalized_skills': normalized_skills,
            'soft_skills': soft_skills,
            'degrees': degrees,
            'experience_list': experience_list,
            'projects': projects,
            'certifications': certifications,
            'awards': awards,
            'projects_count': projects_count,
            'total_experience': total_experience_years,
            'total_experience_years': total_experience_years,
            'relevant_experience': None,
            'education': degree,
            'degree': degree,
            'education_degree': degree,
            'university': _extract_university(text),
            'cgpa': cgpa_value,
            'cgpa_or_percentage': cgpa_or_percentage,
            'sgpa': _extract_sgpa(text),
            'internships': _extract_internships(text),
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

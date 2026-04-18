export type ScoringModel = 'bert' | 'tf-idf' | 'hybrid' | 'ensemble';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface GoogleLoginPayload {
  id_token: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
  is_new_user?: boolean;
}

export interface ResumeUploadResponse {
  id: string;
  name: string;
  filename: string;
  drive_id: string;
}

export interface AnalyzeRequest {
  message: string;
  chat_id?: string;
  model_type?: ScoringModel;
}

export interface AnalyzedCandidate {
  id: string;
  full_name: string;
  score: number;
  breakdown: Record<string, number | string>;
  skills: string[];
  matching_skills: string[];
  missing_skills: string[];
}

export interface AnalyzeResponse {
  chat_id: string;
  message: string;
  candidates: AnalyzedCandidate[];
}

export interface Candidate {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  skills: string[];
  matched_roles?: string[];
  shortlisted_roles?: string[];
  shortlist_entries?: Array<{
    role_id: string;
    role_title?: string | null;
    selected_by?: string | null;
    selection_type?: string | null;
    created_at?: string | null;
  }>;
  is_shortlisted?: boolean;
  selected_type?: string | null;
  auto_selected?: boolean;
  selected?: boolean;
  selection_status?: 'pending' | 'confirmed' | 'rejected' | string;
  total_experience: number | null;
  total_experience_years?: number | null;
  education: string | null;
  degrees?: Array<{ degree?: string | null; field?: string | null; cgpa?: number | null; college?: string | null; location?: string | null }>;
  experience_list?: Array<{ role?: string | null; duration?: string | null }>;
  projects?: string[];
  certifications?: string[];
  awards?: string[];
  soft_skills?: string[];
}

export interface GmailFetchResponse {
  status: string;
  processed_count: number;
  new_candidates_count: number;
}

export type AppTheme = 'light' | 'dark' | 'system';

export interface NotificationSettings {
  candidateAlerts: boolean;
  chatSummaries: boolean;
  productUpdates: boolean;
}

export interface AppSettings {
  theme: AppTheme;
  notifications: NotificationSettings;
}

export interface ChatLogMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

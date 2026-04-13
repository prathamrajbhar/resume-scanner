import axios, { AxiosError } from 'axios';
import {
  AnalyzeRequest,
  AnalyzeResponse,
  AuthResponse,
  Candidate,
  GmailFetchResponse,
  GoogleLoginPayload,
  ResumeUploadResponse,
} from '@/types/resume';
import { clearStoredAuth, getStoredToken } from '@/lib/storage';

type CandidateFilters = {
  roleId?: string;
  shortlisted?: boolean;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const getApiClient = () => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  client.interceptors.request.use((config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401 && typeof window !== 'undefined') {
        const hasTempDashboardAccess = window.localStorage.getItem('temp_dashboard_access') === '1';

        if (!hasTempDashboardAccess) {
          clearStoredAuth();
          const next = encodeURIComponent(window.location.pathname || '/');
          if (!window.location.pathname.startsWith('/login')) {
            window.location.href = `/login?next=${next}`;
          }
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
};

const getErrorMessage = (error: unknown): string => {
  const fallback = 'Something went wrong. Please try again.';

  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const axiosError = error as AxiosError<{ detail?: string }>;
  return axiosError.response?.data?.detail || axiosError.message || fallback;
};

export const googleLogin = async (payload: GoogleLoginPayload): Promise<AuthResponse> => {
  try {
    const api = getApiClient();
    const response = await api.post<AuthResponse>('/api/auth/google/login', payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

const uploadSingleResume = async (file: File): Promise<ResumeUploadResponse> => {
  const api = getApiClient();
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<Record<string, unknown>>('/api/resumes/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const payload = response.data || {};

  return {
    id: String(payload.id ?? `${file.name}-${Date.now()}`),
    name: String(payload.name ?? payload.file_name ?? file.name),
    filename: String(payload.filename ?? payload.file_name ?? file.name),
    drive_id: String(payload.drive_id ?? ''),
  };
};

export const uploadResumes = async (
  files: File[],
  options?: { onProgress?: (completed: number, total: number) => void }
): Promise<ResumeUploadResponse[]> => {
  try {
    const results: ResumeUploadResponse[] = [];
    const total = files.length;

    for (const file of files) {
      const item = await uploadSingleResume(file);
      results.push(item);
      options?.onProgress?.(results.length, total);
    }

    return results;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const analyzeJobDescription = async (payload: AnalyzeRequest): Promise<AnalyzeResponse> => {
  try {
    const api = getApiClient();
    const response = await api.post<AnalyzeResponse>('/api/analyze', payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getCandidates = async (filters?: CandidateFilters): Promise<Candidate[]> => {
  const params: Record<string, string> = {};
  if (filters?.roleId) {
    params.role_id = filters.roleId;
  }
  if (typeof filters?.shortlisted === 'boolean') {
    params.shortlisted = String(filters.shortlisted);
  }

  try {
    const api = getApiClient();
    const response = await api.get<Candidate[]>('/api/candidates/', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return response.data;
  } catch (error) {
    if (typeof window !== 'undefined') {
      try {
        const searchParams = new URLSearchParams();
        if (filters?.roleId) {
          searchParams.set('role_id', filters.roleId);
        }
        if (typeof filters?.shortlisted === 'boolean') {
          searchParams.set('shortlisted', String(filters.shortlisted));
        }
        const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
        const response = await fetch(`/api/db/candidates${query}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (response.ok) {
          return (await response.json()) as Candidate[];
        }
      } catch {
        // Ignore and return backend-originated error below.
      }
    }

    throw new Error(getErrorMessage(error));
  }
};

export const getCandidateById = async (candidateId: string): Promise<Candidate> => {
  try {
    const api = getApiClient();
    const response = await api.get<Candidate>(`/api/candidates/${candidateId}`);
    return response.data;
  } catch (error) {
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch(`/api/db/candidates/${candidateId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (response.ok) {
          return (await response.json()) as Candidate;
        }
      } catch {
        // Ignore and return backend-originated error below.
      }
    }

    throw new Error(getErrorMessage(error));
  }
};

export const shortlistCandidate = async (
  candidateId: string,
  payload: { role_id: string; selection_type: 'select' | 'final_select' }
): Promise<any> => {
  try {
    const api = getApiClient();
    const response = await api.post(`/api/candidates/${candidateId}/shortlist`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const unshortlistCandidate = async (candidateId: string, roleId?: string): Promise<any> => {
  try {
    const api = getApiClient();
    const response = await api.delete(`/api/candidates/${candidateId}/shortlist`, {
      params: roleId ? { role_id: roleId } : undefined,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getMe = async (): Promise<User> => {
  const api = getApiClient();
  const response = await api.get('/api/users/me');
  return response.data;
};

export const updateProfile = async (fullName: string): Promise<User> => {
  try {
    const api = getApiClient();
    const response = await api.patch('/api/users/profile', { full_name: fullName });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteAccount = async (): Promise<void> => {
  const api = getApiClient();
  await api.delete('/api/users/account');
};

// Skills API
export const getSkills = async (): Promise<any[]> => {
  const api = getApiClient();
  const response = await api.get('/api/skills');
  return response.data;
};

export const createSkill = async (skill: { name: string; category?: string; is_global?: boolean }): Promise<any> => {
  const api = getApiClient();
  const response = await api.post('/api/skills', skill);
  return response.data;
};

// Jobs API
export const getJobs = async (): Promise<any[]> => {
  try {
    const api = getApiClient();
    const response = await api.get('/api/jobs/');
    return response.data;
  } catch (error) {
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch('/api/db/jobs', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (response.ok) {
          return (await response.json()) as any[];
        }
      } catch {
        // Ignore and return backend-originated error below.
      }
    }

    throw new Error(getErrorMessage(error));
  }
};

export const getJobById = async (id: string): Promise<any> => {
  try {
    const api = getApiClient();
    const response = await api.get(`/api/jobs/${id}`);
    return response.data;
  } catch (error) {
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch(`/api/db/jobs/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (response.ok) {
          return (await response.json()) as any;
        }
      } catch {
        // Ignore and return backend-originated error below.
      }
    }

    throw new Error(getErrorMessage(error));
  }
};

export const createJob = async (job: { title: string; description?: string; skills: any[] }): Promise<any> => {
  const api = getApiClient();
  const response = await api.post('/api/jobs', job);
  return response.data;
};

export const updateJob = async (
  id: string,
  job: { title?: string; description?: string; skills: any[] }
): Promise<any> => {
  const api = getApiClient();
  const response = await api.patch(`/api/jobs/${id}`, job);
  return response.data;
};

export const deleteJob = async (id: string): Promise<void> => {
  const api = getApiClient();
  await api.delete(`/api/jobs/${id}`);
};

// Resumes API
export const getResumes = async (): Promise<any[]> => {
  const api = getApiClient();
  const response = await api.get('/api/resumes/');
  return response.data;
};

// Analysis API
export const getRecentAnalyses = async (): Promise<any[]> => {
  const api = getApiClient();
  const response = await api.get('/api/analysis/');
  return response.data;
};

export const runAnalysis = async (jobId: string): Promise<any> => {
  const api = getApiClient();
  const response = await api.post('/api/analysis/', null, { params: { job_id: jobId } });
  return response.data;
};

export const runAnalysisForResumes = async (jobId: string, resumeIds: string[]): Promise<any[]> => {
  const api = getApiClient();
  const response = await api.post('/api/analysis/', resumeIds, { params: { job_id: jobId } });
  return response.data;
};

export const getAnalysisForJob = async (jobId: string): Promise<any[]> => {
  const api = getApiClient();
  const response = await api.get('/api/analysis/', { params: { job_id: jobId } });
  return response.data;
};

export const getAnalysisResults = async (jobId?: string): Promise<any[]> => {
  const api = getApiClient();
  const response = await api.get('/api/analysis/results', {
    params: jobId ? { job_id: jobId } : undefined,
  });
  return response.data;
};

export const getResumeById = async (id: string): Promise<any> => {
  const api = getApiClient();
  const response = await api.get(`/api/resumes/${id}`);
  return response.data;
};

export const fetchGmailResumes = async (): Promise<any> => {
  const api = getApiClient();
  const response = await api.post('/api/gmail/fetch');
  return response.data;
};

// Chat API
export const getChatHistory = async (): Promise<any> => {
  const api = getApiClient();
  const response = await api.get('/api/chat/history');
  return response.data;
};

export const createChat = async (title: string): Promise<any> => {
  const api = getApiClient();
  const response = await api.post('/api/chat/new', null, { params: { title } });
  return response.data;
};

export const deleteChat = async (id: string): Promise<void> => {
  const api = getApiClient();
  await api.delete(`/api/chat/${id}`);
};

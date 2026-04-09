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
        clearStoredAuth();
        const next = encodeURIComponent(window.location.pathname || '/');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = `/login?next=${next}`;
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

  const response = await api.post<ResumeUploadResponse>('/api/resumes/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const uploadResumes = async (files: File[]): Promise<ResumeUploadResponse[]> => {
  try {
    const uploads = files.map((file) => uploadSingleResume(file));
    return await Promise.all(uploads);
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

export const getCandidates = async (): Promise<Candidate[]> => {
  try {
    const api = getApiClient();
    const response = await api.get<Candidate[]>('/api/candidates');
    return response.data;
  } catch (error) {
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch('/api/db/candidates', {
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

export const fetchGmailResumes = async (): Promise<GmailFetchResponse> => {
  try {
    const api = getApiClient();
    const response = await api.post<GmailFetchResponse>('/api/gmail/fetch');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from './api';
import { getStoredToken, getStoredUser } from './storage';

// Auth & User
export const useMe = () => {
  const token = getStoredToken();

  return useQuery({
    queryKey: ['me', token || 'no-token'],
    queryFn: api.getMe,
    enabled: !!token,
    initialData: () => getStoredUser() ?? undefined,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
};

// Skills
export const useSkills = () => {
  return useQuery({
    queryKey: ['skills'],
    queryFn: api.getSkills,
  });
};

export const useCreateSkill = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
};

// Job Roles
export const useJobs = () => {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: api.getJobs,
  });
};

export const useJob = (id: string) => {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => api.getJobById(id),
    enabled: !!id,
  });
};

export const useCreateJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useUpdateJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        title?: string;
        description?: string;
        auto_select_enabled?: boolean;
        auto_select_threshold?: number;
        require_hr_confirmation?: boolean;
        skills: any[];
      };
    }) =>
      api.updateJob(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useDeleteJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

// Resumes
export const useResumes = () => {
  return useQuery({
    queryKey: ['resumes'],
    queryFn: api.getResumes,
  });
};

export const useCandidates = (filters?: { roleId?: string; shortlisted?: boolean }) => {
  return useQuery({
    queryKey: ['candidates', filters?.roleId || 'all', String(filters?.shortlisted ?? 'unset')],
    queryFn: () => api.getCandidates(filters),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
};

export const useCandidate = (id: string) => {
  return useQuery({
    queryKey: ['candidates', id],
    queryFn: () => api.getCandidateById(id),
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
};

export const useDeleteCandidate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteCandidate,
    onMutate: async (candidateId: string) => {
      await queryClient.cancelQueries({ queryKey: ['candidates'] });

      const candidateQueries = queryClient.getQueriesData({ queryKey: ['candidates'] });
      for (const [queryKey, data] of candidateQueries) {
        if (!Array.isArray(data)) {
          continue;
        }

        queryClient.setQueryData(
          queryKey,
          data.filter((item: any) => String(item?.id || '') !== candidateId)
        );
      }

      queryClient.removeQueries({ queryKey: ['candidates', candidateId], exact: true });
      return { candidateQueries };
    },
    onError: (_error, _candidateId, context) => {
      for (const [queryKey, data] of context?.candidateQueries || []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    },
  });
};

// Analysis
export const useAnalyses = () => {
  return useQuery({
    queryKey: ['analyses'],
    queryFn: api.getRecentAnalyses, 
  });
};

export const useAnalysis = (jobId: string) => {
  return useQuery({
    queryKey: ['analysis', jobId],
    queryFn: () => api.getAnalysisForJob(jobId),
    enabled: !!jobId,
  });
};

export const useAnalysisResults = (jobId?: string) => {
  return useQuery({
    queryKey: ['analysis-results', jobId],
    queryFn: () => api.getAnalysisResults(jobId),
    enabled: !!jobId,
  });
};

export const useUploadResumes = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.uploadResumes,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
    },
  });
};

export const useRunAnalysis = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.runAnalysis(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis'] });
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
    },
  });
};

export const useSyncGmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.fetchGmailResumes,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
    },
  });
};

export const useResume = (id: string) => {
  return useQuery({
    queryKey: ['resumes', id],
    queryFn: () => api.getResumeById(id),
    enabled: !!id,
  });
};

// Chat
export const useChatHistory = () => {
  return useQuery({
    queryKey: ['chats'],
    queryFn: api.getChatHistory,
  });
};

export const useCreateChat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
};

import { AppSettings, AppTheme, User } from '@/types/resume';

export const USER_STORAGE_KEY = 'resume_scanner_user';
export const TOKEN_STORAGE_KEY = 'resume_scanner_token';
export const SETTINGS_STORAGE_KEY = 'resume_scanner_settings';
export const CHAT_MESSAGES_STORAGE_KEY = 'resume_scanner_chat_messages';
export const CHAT_UPLOADS_STORAGE_KEY = 'resume_scanner_chat_uploads';
export const CHAT_ID_STORAGE_KEY = 'resume_scanner_chat_id';
export const CHAT_SESSIONS_STORAGE_KEY = 'resume_scanner_chat_sessions';

export const defaultSettings: AppSettings = {
  theme: 'light',
  notifications: {
    candidateAlerts: true,
    chatSummaries: true,
    productUpdates: false,
  },
};

const isBrowser = () => typeof window !== 'undefined';
let systemThemeMediaQuery: MediaQueryList | null = null;
let systemThemeListener: (() => void) | null = null;

const setAuthCookie = (token: string) => {
  if (!isBrowser()) {
    return;
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${TOKEN_STORAGE_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=604800; SameSite=Lax${secure}`;
};

const clearAuthCookie = () => {
  if (!isBrowser()) {
    return;
  }

  document.cookie = `${TOKEN_STORAGE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
};

export const getStoredToken = (): string | null => {
  if (!isBrowser()) {
    return null;
  }

  const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  return token && token.trim() ? token : null;
};

export const setStoredToken = (token: string) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  setAuthCookie(token);
  window.dispatchEvent(new Event('resume:auth-updated'));
};

export const getStoredUser = (): User | null => {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
};

export const setStoredUser = (user: User | null) => {
  if (!isBrowser()) {
    return;
  }

  if (!user) {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } else {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }

  window.dispatchEvent(new Event('resume:user-updated'));
};

export const getStoredSettings = (): AppSettings => {
  if (!isBrowser()) {
    return defaultSettings;
  }

  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return defaultSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...defaultSettings,
      ...parsed,
    };
  } catch {
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    return defaultSettings;
  }
};

export const setStoredSettings = (settings: AppSettings) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event('resume:settings-updated'));
};

const resolveTheme = (theme: AppTheme): 'light' | 'dark' => {
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  return theme;
};

const detachSystemThemeListener = () => {
  if (!systemThemeMediaQuery || !systemThemeListener) {
    return;
  }

  systemThemeMediaQuery.removeEventListener('change', systemThemeListener);
  systemThemeMediaQuery = null;
  systemThemeListener = null;
};

const attachSystemThemeListener = () => {
  detachSystemThemeListener();

  systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemThemeListener = () => {
    const nextTheme = systemThemeMediaQuery?.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.documentElement.style.colorScheme = nextTheme;
  };

  systemThemeMediaQuery.addEventListener('change', systemThemeListener);
};

export const applyStoredTheme = () => {
  if (!isBrowser()) {
    return;
  }

  const theme = getStoredSettings().theme;
  const resolvedTheme = resolveTheme(theme);
  detachSystemThemeListener();

  if (theme === 'system') {
    attachSystemThemeListener();
  }

  document.documentElement.setAttribute('data-theme', resolvedTheme);
  document.documentElement.style.colorScheme = resolvedTheme;
};

export const clearStoredChats = () => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY);
  window.localStorage.removeItem(CHAT_UPLOADS_STORAGE_KEY);
  window.localStorage.removeItem(CHAT_ID_STORAGE_KEY);
  window.localStorage.removeItem(CHAT_SESSIONS_STORAGE_KEY);
  window.dispatchEvent(new Event('resume:chats-cleared'));
};

export const clearStoredAuth = () => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
  clearAuthCookie();
  window.dispatchEvent(new Event('resume:auth-updated'));
  window.dispatchEvent(new Event('resume:user-updated'));
};
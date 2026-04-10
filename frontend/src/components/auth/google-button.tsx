import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';

type GoogleButtonProps = {
  loading: boolean;
  disabled: boolean;
  onSuccess: (credentialResponse: CredentialResponse) => void;
  onError: () => void;
};

export function GoogleButton({ loading, disabled, onSuccess, onError }: GoogleButtonProps) {
  if (disabled) {
    return (
      <p className="rounded-xl border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] px-3 py-2 text-sm text-[var(--app-danger-text)]">
        Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend environment configuration.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="surface-panel-soft flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm text-muted">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        Verifying account...
      </div>
    );
  }

  return (
    <div className="surface-panel-soft flex h-11 w-full items-center justify-center rounded-full px-2 transition-transform duration-200 hover:-translate-y-0.5 [&>div]:!w-full [&_div]:!max-w-none [&_iframe]:!w-full">
      <GoogleLogin
        onSuccess={onSuccess}
        onError={onError}
        shape="pill"
        size="large"
        text="continue_with"
        theme="outline"
        width="100%"
      />
    </div>
  );
}

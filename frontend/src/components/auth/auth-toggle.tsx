import { cn } from '@/lib/utils';

export type AuthMode = 'login' | 'signup';

type AuthToggleProps = {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
};

export function AuthToggle({ mode, onChange }: AuthToggleProps) {
  return (
    <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
      <button
        type="button"
        onClick={() => onChange('login')}
        className={cn(
          'rounded-lg px-3 py-2 text-sm font-medium transition-all',
          mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
        )}
      >
        Log in
      </button>
      <button
        type="button"
        onClick={() => onChange('signup')}
        className={cn(
          'rounded-lg px-3 py-2 text-sm font-medium transition-all',
          mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
        )}
      >
        Sign up
      </button>
    </div>
  );
}

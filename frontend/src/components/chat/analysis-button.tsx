import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AnalysisButtonProps = {
  disabled: boolean;
  loading?: boolean;
  onClick: () => void;
};

export function AnalysisButton({ disabled, loading = false, onClick }: AnalysisButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="h-11 w-full text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Analyzing resumes...' : 'Analyze Resumes'}
      {loading ? null : <Rocket className="h-4 w-4" />}
    </Button>
  );
}

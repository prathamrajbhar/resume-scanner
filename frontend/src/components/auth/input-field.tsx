import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function InputField({ label, className, id, ...props }: InputFieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input
        id={id}
        className={cn(
          'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400',
          'outline-none ring-0 transition focus:border-slate-400 focus:shadow-[0_0_0_4px_rgba(148,163,184,0.15)]',
          className
        )}
        {...props}
      />
    </label>
  );
}

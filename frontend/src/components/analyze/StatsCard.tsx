import { ReactNode } from 'react';

type StatsCardProps = {
  title: string;
  value: string;
  subtitle: string;
  subtitleTone?: 'default' | 'success';
  icon?: ReactNode;
};

export function StatsCard({ title, value, subtitle, subtitleTone = 'default', icon }: StatsCardProps) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        {icon ? (
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gray-200 bg-gray-100 px-2 text-xs font-semibold text-gray-600">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-4xl font-semibold tracking-tight text-gray-900">{value}</p>
      <p className={`mt-2 text-sm ${subtitleTone === 'success' ? 'font-medium text-green-600' : 'text-gray-500'}`}>
        {subtitle}
      </p>
    </article>
  );
}

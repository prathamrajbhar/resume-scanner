import { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  icon?: ReactNode;
}

export default function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <Card className="group transition-transform duration-300 hover:-translate-y-0.5">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-[var(--app-muted)]">{label}</CardTitle>
        {icon ? <span className="text-[var(--app-subtle)]">{icon}</span> : <ArrowUpRight className="h-4 w-4 text-[var(--app-subtle)]" />}
      </CardHeader>
      <CardContent>
        <p className="font-display text-3xl font-semibold">{value}</p>
        <div className="mt-3">
          <Badge variant="secondary">{hint}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
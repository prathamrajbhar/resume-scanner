'use client';

import { PropsWithChildren } from 'react';
import AppShell from '@/components/app-shell';

export default function AppLayout({ children }: PropsWithChildren) {
  return <AppShell>{children}</AppShell>;
}

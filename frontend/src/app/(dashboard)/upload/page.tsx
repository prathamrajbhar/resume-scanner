'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';

export default function UploadPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/chatbase');
  }, [router]);

  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <Card>
        <CardContent className="p-6 text-[var(--app-muted)]">Redirecting to Chatbase...</CardContent>
      </Card>
    </div>
  );
}

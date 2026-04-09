import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

function Avatar({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)]',
        className
      )}
    >
      {children}
    </div>
  );
}

type AvatarImageProps = Omit<React.ComponentProps<typeof Image>, 'width' | 'height'> & {
  size?: number;
};

function AvatarImage({ className, size = 40, alt = '', ...props }: AvatarImageProps) {
  return <Image width={size} height={size} alt={alt} className={cn('h-full w-full object-cover', className)} {...props} />;
}

function AvatarFallback({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('text-xs font-semibold text-[var(--app-muted)]', className)} {...props} />;
}

export { Avatar, AvatarImage, AvatarFallback };

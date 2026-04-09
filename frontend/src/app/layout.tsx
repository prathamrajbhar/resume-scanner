import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/app-shell';
import Providers from '@/components/providers';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'Resume Scanner | Hiring Workspace',
  description: 'Modern AI-powered workspace for resume intake, candidate ranking, and recruiter workflows.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}

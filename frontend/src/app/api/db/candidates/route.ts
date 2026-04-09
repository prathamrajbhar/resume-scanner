import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

export async function GET() {
  try {
    const candidates = await prisma.candidate.findMany({
      orderBy: {
        full_name: 'asc',
      },
    });

    const normalized = candidates.map((candidate: { skills: unknown } & Record<string, unknown>) => ({
      ...candidate,
      skills: toStringArray(candidate.skills),
    }));

    return NextResponse.json(normalized, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to query candidates';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

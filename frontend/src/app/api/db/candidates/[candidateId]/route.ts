import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

type Context = {
  params: Promise<{ candidateId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { candidateId } = await context.params;

    const candidate = await prisma.candidate.findUnique({
      where: {
        id: candidateId,
      },
    });

    if (!candidate) {
      return NextResponse.json({ detail: 'Candidate not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        ...candidate,
        skills: toStringArray(candidate.skills),
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to query candidate';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

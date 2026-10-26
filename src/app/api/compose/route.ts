import { NextResponse } from 'next/server';
import { writeDraft } from '@/server/ai';
import { badRequest, errorMessage } from '@/server/http';
import { getEmail, getLanguage } from '@/server/repo';

export const dynamic = 'force-dynamic';

/** AI-assisted drafting: rewrites the current draft according to a free-form instruction. */
export async function POST(request: Request) {
  const body = (await request.json()) as { instruction?: string; to?: string; subject?: string; body?: string; replyToEmailId?: number | null };
  if (!body.instruction?.trim()) return badRequest('instruction is required');
  try {
    const result = await writeDraft(
      {
        instruction: body.instruction,
        to: body.to ?? '',
        subject: body.subject ?? '',
        body: body.body ?? '',
        replyTo: body.replyToEmailId ? getEmail(body.replyToEmailId) : null,
      },
      getLanguage(),
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 502 });
  }
}

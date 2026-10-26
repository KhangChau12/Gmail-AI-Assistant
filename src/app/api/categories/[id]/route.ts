import { NextResponse } from 'next/server';
import { notFound, parseId } from '@/server/http';
import { deleteCategory, updateCategory } from '@/server/repo';
import { CATEGORY_COLORS, CATEGORY_ICONS, type CategoryColor, type CategoryIcon } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  const id = parseId(params.id);
  if (!id) return notFound();
  const body = (await request.json()) as { name?: string; description?: string; color?: string; icon?: string };
  updateCategory(id, {
    name: body.name?.trim() || undefined,
    description: body.description,
    color: CATEGORY_COLORS.includes(body.color as CategoryColor) ? (body.color as CategoryColor) : undefined,
    icon: CATEGORY_ICONS.includes(body.icon as CategoryIcon) ? (body.icon as CategoryIcon) : undefined,
  });
  return NextResponse.json({ ok: true });
}

export function DELETE(_: Request, { params }: Params) {
  const id = parseId(params.id);
  if (!id) return notFound();
  deleteCategory(id);
  return NextResponse.json({ ok: true });
}

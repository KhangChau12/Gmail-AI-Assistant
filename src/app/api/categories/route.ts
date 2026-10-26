import { NextResponse } from 'next/server';
import { badRequest } from '@/server/http';
import { createCategory, listCategories } from '@/server/repo';
import { CATEGORY_COLORS, CATEGORY_ICONS, type CategoryColor, type CategoryIcon } from '@/lib/types';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(listCategories());
}

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; description?: string; color?: string; icon?: string };
  if (!body.name?.trim()) return badRequest('name is required');
  return NextResponse.json(
    createCategory({
      name: body.name.trim(),
      description: body.description?.trim() ?? '',
      color: CATEGORY_COLORS.includes(body.color as CategoryColor) ? (body.color as CategoryColor) : 'indigo',
      icon: CATEGORY_ICONS.includes(body.icon as CategoryIcon) ? (body.icon as CategoryIcon) : 'tag',
    }),
  );
}

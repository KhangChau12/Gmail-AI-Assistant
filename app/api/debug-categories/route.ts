import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/db';

export async function GET() {
  try {
    const categories = await getCategories();
    
    return NextResponse.json({
      categories: categories,
      prompt_preview: categories.map(c => `${c.id}: ${c.name} - ${c.description}`).join('\n')
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
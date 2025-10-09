import { NextRequest, NextResponse } from 'next/server';
import { getCategories, getEmailAssignments } from '@/lib/db';
import { classifyEmail } from '../ai-internal';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    // Get categories and assignments for AI classification
    const categories = await getCategories();
    const assignments = await getEmailAssignments();

    console.log('Testing classification with categories:', categories.map(c => `${c.id}: ${c.name}`));
    console.log('Email to classify:', { from: email.from, subject: email.subject });

    const result = await classifyEmail(email, categories, assignments);
    
    console.log('Classification result:', result);
    
    // Find which category was selected
    const selectedCategories = result?.categories?.map(cat => {
      const category = categories.find(c => c.id === cat.category_id);
      return {
        ...cat,
        category_name: category?.name,
        category_description: category?.description
      };
    }) || [];

    return NextResponse.json({
      email: {
        from: email.from,
        subject: email.subject,
        body: email.body?.substring(0, 200) + '...'
      },
      available_categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description
      })),
      classification_result: result,
      selected_categories: selectedCategories,
      debug_info: {
        categories_count: categories.length,
        assignments_count: assignments.length
      }
    });
  } catch (error) {
    console.error('Test classification error:', error);
    return NextResponse.json(
      { error: 'Failed to test classification', details: error.message },
      { status: 500 }
    );
  }
}
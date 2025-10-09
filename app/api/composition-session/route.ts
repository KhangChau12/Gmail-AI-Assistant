import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

// Create a new composition session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId, replyToMessageId } = body;

    // Insert new composition session
    const { data, error } = await supabase
      .from('composition_sessions')
      .insert([{
        draft_id: draftId,
        reply_to_message_id: replyToMessageId
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating composition session:', error);
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating composition session:', error);
    return NextResponse.json(
      { error: 'Failed to create composition session' },
      { status: 500 }
    );
  }
}

// Get all composition sessions (for debugging/admin)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('composition_sessions')
      .select(`
        *,
        drafts (
          subject,
          to_email
        )
      `)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Supabase error fetching composition sessions:', error);
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching composition sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch composition sessions' },
      { status: 500 }
    );
  }
}
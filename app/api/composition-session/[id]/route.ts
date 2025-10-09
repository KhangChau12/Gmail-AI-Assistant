import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

// Get a specific composition session with its messages
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id;

    // Get session details with related draft and messages
    const { data: session, error: sessionError } = await supabase
      .from('composition_sessions')
      .select(`
        *,
        drafts (
          subject,
          to_email,
          body
        ),
        composition_chat_messages (
          *
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      throw sessionError;
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error fetching composition session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch composition session' },
      { status: 500 }
    );
  }
}

// Update composition session
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id;
    const body = await request.json();
    const { draftId } = body;

    const { data, error } = await supabase
      .from('composition_sessions')
      .update({ 
        draft_id: draftId,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating composition session:', error);
    return NextResponse.json(
      { error: 'Failed to update composition session' },
      { status: 500 }
    );
  }
}

// Delete composition session
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id;

    // Delete session (related messages will be deleted via CASCADE)
    const { error } = await supabase
      .from('composition_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting composition session:', error);
    return NextResponse.json(
      { error: 'Failed to delete composition session' },
      { status: 500 }
    );
  }
}
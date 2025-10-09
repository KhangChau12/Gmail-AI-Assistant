import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

// Save chat messages to composition session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      userMessage,
      aiResponse,
      suggestedSubject,
      suggestedBody,
      suggestionApplied = false
    } = body;

    // Insert chat message record
    const { data, error } = await supabase
      .from('composition_chat_messages')
      .insert([{
        session_id: sessionId,
        user_message: userMessage,
        ai_response: aiResponse,
        suggested_subject: suggestedSubject || null,
        suggested_body: suggestedBody || null,
        suggestion_applied: suggestionApplied
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error saving chat message:', error);
      throw error;
    }

    // Update session timestamp
    await supabase
      .from('composition_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving composition chat message:', error);
    return NextResponse.json(
      { error: 'Failed to save chat message' },
      { status: 500 }
    );
  }
}

// Update suggestion applied status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, suggestionApplied } = body;

    const { data, error } = await supabase
      .from('composition_chat_messages')
      .update({ suggestion_applied: suggestionApplied })
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Message not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating suggestion status:', error);
    return NextResponse.json(
      { error: 'Failed to update suggestion status' },
      { status: 500 }
    );
  }
}
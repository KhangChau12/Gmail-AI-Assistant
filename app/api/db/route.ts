import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getContacts,
  createContact,
  updateContact,
  findContactByEmail,
  searchContacts,
  getDrafts,
  createDraft,
  updateDraft,
  deleteDraft,
  getProcessedEmails,
  getProcessedEmailById,
  updateProcessedEmail
} from '@/lib/db';

// Helper function to create consistent UTF-8 JSON responses
function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

// Categories endpoints
async function handleCategories(request: NextRequest, method: string) {
  switch (method) {
    case 'GET':
      const categories = await getCategories();
      return jsonResponse(categories);

    case 'POST':
      const newCategory = await request.json();
      const created = await createCategory(newCategory);
      return jsonResponse(created);

    case 'PUT':
      const updateData = await request.json();
      const { id, ...updates } = updateData;
      const updated = await updateCategory(id, updates);
      return jsonResponse(updated);

    case 'DELETE':
      const { searchParams } = new URL(request.url);
      const categoryId = searchParams.get('id');
      if (!categoryId) {
        return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
      }
      await deleteCategory(categoryId);
      return NextResponse.json({ success: true });

    default:
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
}

// Contacts endpoints
async function handleContacts(request: NextRequest, method: string) {
  switch (method) {
    case 'GET':
      const { searchParams } = new URL(request.url);
      const query = searchParams.get('search');
      const email = searchParams.get('email');

      if (query) {
        const searchResults = await searchContacts(query);
        return NextResponse.json(searchResults);
      }

      if (email) {
        const contact = await findContactByEmail(email);
        return NextResponse.json(contact);
      }

      const contacts = await getContacts();
      return NextResponse.json(contacts);

    case 'POST':
      const newContact = await request.json();
      const createdContact = await createContact(newContact);
      return NextResponse.json(createdContact);

    case 'PUT':
      const updateData = await request.json();
      const { id, ...updates } = updateData;
      const updatedContact = await updateContact(id, updates);
      return NextResponse.json(updatedContact);

    default:
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
}

// Drafts endpoints
async function handleDrafts(request: NextRequest, method: string) {
  switch (method) {
    case 'GET':
      const drafts = await getDrafts();
      return NextResponse.json(drafts);

    case 'POST':
      const newDraft = await request.json();
      const createdDraft = await createDraft(newDraft);
      return NextResponse.json(createdDraft);

    case 'PUT':
      const updateData = await request.json();
      const { id, ...updates } = updateData;
      const updatedDraft = await updateDraft(id, updates);
      return NextResponse.json(updatedDraft);

    case 'DELETE':
      const { searchParams } = new URL(request.url);
      const draftId = searchParams.get('id');
      if (!draftId) {
        return NextResponse.json({ error: 'Draft ID required' }, { status: 400 });
      }
      await deleteDraft(draftId);
      return NextResponse.json({ success: true });

    default:
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
}

// Emails endpoints
async function handleEmails(request: NextRequest, method: string) {
  switch (method) {
    case 'GET':
      const { searchParams } = new URL(request.url);
      const emailId = searchParams.get('id');
      const categoryId = searchParams.get('category');

      if (emailId) {
        const email = await getProcessedEmailById(emailId);
        if (!email) {
          return NextResponse.json({ error: 'Email not found' }, { status: 404 });
        }
        return NextResponse.json(email);
      }

      // Handle special case for uncategorized emails
      let emailCategoryFilter = categoryId || undefined;
      if (categoryId === 'uncategorized') {
        emailCategoryFilter = null; // This will fetch emails where category_id IS NULL
      }
      
      const emails = await getProcessedEmails(emailCategoryFilter);
      return NextResponse.json(emails);

    case 'PUT':
      const updateData = await request.json();
      const { id, ...updates } = updateData;
      const updatedEmail = await updateProcessedEmail(id, updates);
      return NextResponse.json(updatedEmail);

    default:
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
}

// Email summary for dashboard - optimized with database function
async function getEmailSummary() {
  try {
    const { data, error } = await supabase.rpc('get_email_summary');
    
    if (error) {
      console.error('Database function error:', error);
      throw error;
    }
    
    // The function returns an array with one row, get the first (and only) result
    const result = data?.[0];
    
    if (!result) {
      return NextResponse.json({
        total: 0,
        unread: 0,
        categories: []
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting email summary:', error);
    return NextResponse.json({ error: 'Failed to get summary' }, { status: 500 });
  }
}

// Main API Route Handlers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resource = searchParams.get('resource');

    switch (resource) {
      case 'categories':
        return handleCategories(request, 'GET');
      
      case 'contacts':
        return handleContacts(request, 'GET');
      
      case 'drafts':
        return handleDrafts(request, 'GET');
      
      case 'emails':
        return handleEmails(request, 'GET');
      
      case 'summary':
        return getEmailSummary();
      
      default:
        return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
    }
  } catch (error) {
    console.error('Database API GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resource = searchParams.get('resource');

    switch (resource) {
      case 'categories':
        return handleCategories(request, 'POST');
      
      case 'contacts':
        return handleContacts(request, 'POST');
      
      case 'drafts':
        return handleDrafts(request, 'POST');
      
      default:
        return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
    }
  } catch (error) {
    console.error('Database API POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resource = searchParams.get('resource');

    switch (resource) {
      case 'categories':
        return handleCategories(request, 'PUT');
      
      case 'contacts':
        return handleContacts(request, 'PUT');
      
      case 'drafts':
        return handleDrafts(request, 'PUT');
      
      case 'emails':
        return handleEmails(request, 'PUT');
      
      default:
        return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
    }
  } catch (error) {
    console.error('Database API PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resource = searchParams.get('resource');

    switch (resource) {
      case 'categories':
        return handleCategories(request, 'DELETE');
      
      case 'drafts':
        return handleDrafts(request, 'DELETE');
      
      default:
        return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
    }
  } catch (error) {
    console.error('Database API DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
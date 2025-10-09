import { createClient } from '@supabase/supabase-js';
import { Category, Contact, EmailAssignment, Draft, ProcessedEmail } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database Schema Setup (run once)
export const setupDatabase = async () => {
  const { error } = await supabase.rpc('setup_gmail_assistant_schema');
  if (error) {
    console.error('Database setup error:', error);
    throw error;
  }
};

// Categories CRUD
export const getCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const createCategory = async (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> => {
  const { data, error } = await supabase
    .from('categories')
    .insert([category])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateCategory = async (id: string, updates: Partial<Category>): Promise<Category> => {
  const { data, error } = await supabase
    .from('categories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteCategory = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Contacts CRUD
export const getContacts = async (): Promise<Contact[]> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const createContact = async (contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>): Promise<Contact> => {
  const { data, error } = await supabase
    .from('contacts')
    .insert([contact])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateContact = async (id: string, updates: Partial<Contact>): Promise<Contact> => {
  const { data, error } = await supabase
    .from('contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const findContactByEmail = async (email: string): Promise<Contact | null> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
};

export const searchContacts = async (query: string): Promise<Contact[]> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .or(`name.ilike.%${query}%,email.ilike.%${query}%,aliases.cs.{${query}}`);
  
  if (error) throw error;
  return data || [];
};

// Email Assignments CRUD
export const getEmailAssignments = async (): Promise<EmailAssignment[]> => {
  const { data, error } = await supabase
    .from('email_assignments')
    .select('*')
    .order('assigned_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const createEmailAssignment = async (assignment: Omit<EmailAssignment, 'id' | 'assigned_at'>): Promise<EmailAssignment> => {
  // Check if assignment already exists
  const { data: existing } = await supabase
    .from('email_assignments')
    .select('*')
    .eq('sender_email', assignment.sender_email)
    .single();

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('email_assignments')
      .update({
        category_id: assignment.category_id,
        confidence_score: assignment.confidence_score,
        assigned_at: new Date().toISOString()
      })
      .eq('sender_email', assignment.sender_email)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } else {
    // Create new
    const { data, error } = await supabase
      .from('email_assignments')
      .insert([assignment])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Drafts CRUD
export const getDrafts = async (): Promise<Draft[]> => {
  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const createDraft = async (draft: Omit<Draft, 'id' | 'created_at' | 'updated_at'>): Promise<Draft> => {
  const { data, error } = await supabase
    .from('drafts')
    .insert([draft])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateDraft = async (id: string, updates: Partial<Draft>): Promise<Draft> => {
  const { data, error } = await supabase
    .from('drafts')
    .update({ 
      ...updates, 
      updated_at: new Date().toISOString(),
      version: updates.version || 1
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteDraft = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('drafts')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Processed Emails CRUD
export const getProcessedEmails = async (categoryId?: string | null): Promise<ProcessedEmail[]> => {
  let query = supabase
    .from('processed_emails')
    .select('*');

  if (categoryId === null) {
    // Explicitly filter for emails with no category (uncategorized)
    query = query.is('category_id', null);
  } else if (categoryId) {
    // Filter for emails with specific category
    query = query.eq('category_id', categoryId);
  }
  // If categoryId is undefined, return all emails (no filter)

  const { data, error } = await query
    .order('received_date', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const getProcessedEmailById = async (id: string): Promise<ProcessedEmail | null> => {
  const { data, error } = await supabase
    .from('processed_emails')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const createProcessedEmail = async (email: Omit<ProcessedEmail, 'id' | 'processed_at'>): Promise<ProcessedEmail> => {
  console.log('Creating processed email in database:', {
    imap_uid: email.imap_uid,
    subject: email.subject,
    sender_email: email.sender_email
  });
  
  const { data, error } = await supabase
    .from('processed_emails')
    .insert([email])
    .select()
    .single();
  
  if (error) {
    console.error('Database insert error for processed_emails:', error);
    console.error('Failed email data:', email);
    throw error;
  }
  
  console.log('Successfully inserted email into database with ID:', data?.id);
  return data;
};

export const updateProcessedEmail = async (id: string, updates: Partial<ProcessedEmail>): Promise<ProcessedEmail> => {
  const { data, error } = await supabase
    .from('processed_emails')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const getEmailByImapUid = async (imapUid: string): Promise<ProcessedEmail | null> => {
  const { data, error } = await supabase
    .from('processed_emails')
    .select('*')
    .eq('imap_uid', imapUid)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

// Multi-category support functions
export const assignEmailCategories = async (
  emailId: string, 
  categories: Array<{category_id: string, confidence: number}>
): Promise<void> => {
  if (categories.length === 0) return;

  // Remove existing category assignments for this email
  await supabase
    .from('email_categories')
    .delete()
    .eq('email_id', emailId);

  // Insert new category assignments
  const assignments = categories.map(cat => ({
    email_id: emailId,
    category_id: cat.category_id,
    confidence_score: cat.confidence,
    assigned_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from('email_categories')
    .insert(assignments);

  if (error) {
    console.error('Failed to assign email categories:', error);
    // Don't throw - email creation should still succeed even if category assignment fails
  }
};

export const getEmailCategories = async (emailId: string) => {
  const { data, error } = await supabase
    .from('email_categories')
    .select(`
      category_id,
      confidence_score,
      assigned_at,
      categories!inner (
        id,
        name,
        description,
        color
      )
    `)
    .eq('email_id', emailId)
    .order('confidence_score', { ascending: false });

  if (error) throw error;
  return data || [];
};

// Email Read Status Management
export const updateEmailReadStatus = async (imapUid: string, isRead: boolean): Promise<void> => {
  const { error } = await supabase
    .from('processed_emails')
    .update({ is_read: isRead })
    .eq('imap_uid', imapUid);

  if (error) {
    console.error('Failed to update email read status:', error);
    throw error;
  }
};

// Database Query Functions for Chat Agent
export interface EmailQueryFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  senderEmail?: string;
  isRead?: boolean;
  limit?: number;
  offset?: number;
}

export interface EmailAnalysisResult {
  totalEmails: number;
  unreadCount: number;
  categoryBreakdown: Array<{
    category: Category;
    count: number;
    unreadCount: number;
  }>;
  topSenders: Array<{
    email: string;
    name?: string;
    count: number;
  }>;
  recentEmails: ProcessedEmail[];
  insights: string[];
}

// Query emails by date range with optional filters
export const queryEmailsByDateRange = async (filters: EmailQueryFilters): Promise<ProcessedEmail[]> => {
  let query = supabase
    .from('processed_emails')
    .select(`
      *,
      categories (
        id,
        name,
        description,
        color
      )
    `);

  // Apply date filters
  if (filters.startDate) {
    query = query.gte('received_date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('received_date', filters.endDate);
  }

  // Apply other filters
  if (filters.categoryId === null) {
    query = query.is('category_id', null);
  } else if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }

  if (filters.senderEmail) {
    query = query.ilike('sender_email', `%${filters.senderEmail}%`);
  }

  if (filters.isRead !== undefined) {
    query = query.eq('is_read', filters.isRead);
  }

  // Apply pagination
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  // Order by most recent first
  query = query.order('received_date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Failed to query emails by date range:', error);
    throw error;
  }

  return data || [];
};

// Get comprehensive email analysis for AI agent
export const analyzeEmailsForAgent = async (filters: EmailQueryFilters): Promise<EmailAnalysisResult> => {
  try {
    // Get filtered emails
    const emails = await queryEmailsByDateRange(filters);

    // Get all categories for breakdown
    const categories = await getCategories();

    // Calculate total and unread counts
    const totalEmails = emails.length;
    const unreadCount = emails.filter(e => !e.is_read).length;

    // Category breakdown
    const categoryBreakdown = categories.map(category => {
      const categoryEmails = emails.filter(e => e.category_id === category.id);
      return {
        category,
        count: categoryEmails.length,
        unreadCount: categoryEmails.filter(e => !e.is_read).length
      };
    }).filter(cb => cb.count > 0);

    // Add uncategorized emails
    const uncategorizedEmails = emails.filter(e => !e.category_id);
    if (uncategorizedEmails.length > 0) {
      categoryBreakdown.push({
        category: {
          id: 'uncategorized',
          name: 'Chưa phân loại',
          description: 'Email chưa được phân loại vào danh mục cụ thể',
          color: '#64748b',
          gmail_label: undefined,
          created_at: '',
          updated_at: ''
        },
        count: uncategorizedEmails.length,
        unreadCount: uncategorizedEmails.filter(e => !e.is_read).length
      });
    }

    // Top senders analysis
    const senderMap = new Map<string, { name?: string; count: number }>();
    emails.forEach(email => {
      if (email.sender_email) {
        const existing = senderMap.get(email.sender_email) || { count: 0 };
        senderMap.set(email.sender_email, {
          name: email.sender_name || existing.name,
          count: existing.count + 1
        });
      }
    });

    const topSenders = Array.from(senderMap.entries())
      .map(([email, data]) => ({
        email,
        name: data.name,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Recent emails (up to 20 most recent)
    const recentEmails = emails.slice(0, 20);

    // Generate insights
    const insights: string[] = [];

    if (unreadCount > 0) {
      insights.push(`Bạn có ${unreadCount} email chưa đọc`);
    }

    if (categoryBreakdown.length > 0) {
      const topCategory = categoryBreakdown.sort((a, b) => b.count - a.count)[0];
      insights.push(`Danh mục có nhiều email nhất: ${topCategory.category.name} (${topCategory.count} email)`);
    }

    if (topSenders.length > 0) {
      insights.push(`Người gửi nhiều email nhất: ${topSenders[0].name || topSenders[0].email} (${topSenders[0].count} email)`);
    }

    return {
      totalEmails,
      unreadCount,
      categoryBreakdown,
      topSenders,
      recentEmails,
      insights
    };

  } catch (error) {
    console.error('Failed to analyze emails for agent:', error);
    throw error;
  }
};

// Helper function to parse Vietnamese date queries
export const parseDateQuery = (query: string): { startDate?: string; endDate?: string } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Normalize query to lowercase
  const normalizedQuery = query.toLowerCase();

  if (normalizedQuery.includes('hôm nay') || normalizedQuery.includes('ngày hôm nay')) {
    return {
      startDate: today.toISOString(),
      endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
    };
  }

  if (normalizedQuery.includes('hôm qua')) {
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    return {
      startDate: yesterday.toISOString(),
      endDate: today.toISOString()
    };
  }

  if (normalizedQuery.includes('tuần này') || normalizedQuery.includes('trong tuần')) {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    return {
      startDate: startOfWeek.toISOString(),
      endDate: new Date().toISOString()
    };
  }

  if (normalizedQuery.includes('tháng này') || normalizedQuery.includes('trong tháng')) {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      startDate: startOfMonth.toISOString(),
      endDate: new Date().toISOString()
    };
  }

  // Check for specific date patterns like "13/9/2025"
  const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const match = query.match(datePattern);
  if (match) {
    const [, day, month, year] = match;
    const specificDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return {
      startDate: specificDate.toISOString(),
      endDate: new Date(specificDate.getTime() + 24 * 60 * 60 * 1000).toISOString()
    };
  }

  return {};
};

/*
SQL Schema for Supabase (Run this once in SQL editor):

-- Categories table
CREATE TABLE categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  color text DEFAULT '#3b82f6',
  gmail_label text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Contacts table
CREATE TABLE contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  aliases text[] DEFAULT '{}',
  category text,
  notes text,
  extracted_from_email boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Email assignments table
CREATE TABLE email_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_email text NOT NULL,
  sender_name text,
  category_id uuid REFERENCES categories(id),
  confidence_score decimal(3,2),
  assigned_at timestamp DEFAULT now()
);

-- Drafts table
CREATE TABLE drafts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  body text NOT NULL,
  reply_to_message_id text,
  version integer DEFAULT 1,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Processed emails table
CREATE TABLE processed_emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  imap_uid text NOT NULL UNIQUE,
  message_id text,
  sender_email text,
  sender_name text,
  subject text,
  body_text text,
  body_html text,
  category_id uuid REFERENCES categories(id),
  summary text,
  received_date timestamp,
  processed_at timestamp DEFAULT now(),
  parsing_status text DEFAULT 'success' CHECK (parsing_status IN ('success', 'failed', 'partial')),
  content_length integer DEFAULT 0,
  parsing_errors jsonb,
  last_reprocessed timestamp
);

-- Indexes for performance
CREATE INDEX idx_processed_emails_category ON processed_emails(category_id);
CREATE INDEX idx_processed_emails_received ON processed_emails(received_date DESC);
CREATE INDEX idx_processed_emails_parsing_status ON processed_emails(parsing_status);
CREATE INDEX idx_processed_emails_last_reprocessed ON processed_emails(last_reprocessed DESC);
CREATE INDEX idx_email_assignments_sender ON email_assignments(sender_email);
CREATE INDEX idx_contacts_email ON contacts(email);
*/
-- Gmail AI Assistant - Complete Database Schema
-- Run this in Supabase SQL Editor after dropping all existing tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop all existing tables (in correct order to avoid foreign key issues)
DROP TABLE IF EXISTS email_categories CASCADE;
DROP TABLE IF EXISTS email_assignments CASCADE;
DROP TABLE IF EXISTS processed_emails CASCADE;
DROP TABLE IF EXISTS drafts CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Categories table
CREATE TABLE categories (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Contacts table
CREATE TABLE contacts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  aliases text[] DEFAULT '{}',
  extracted_from_email boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Email assignments table (for AI learning)
CREATE TABLE email_assignments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_email text NOT NULL,
  sender_name text,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  confidence_score real NOT NULL DEFAULT 0.5,
  assigned_at timestamp DEFAULT now(),
  UNIQUE(sender_email, category_id)
);

-- Drafts table
CREATE TABLE drafts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  subject text NOT NULL,
  body text NOT NULL,
  to_email text,
  to_name text,
  version integer DEFAULT 1,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Processed emails table (main table)
CREATE TABLE processed_emails (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  imap_uid text NOT NULL UNIQUE,
  message_id text,
  sender_email text,
  sender_name text,
  subject text,
  body_text text,
  body_html text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  summary text,
  received_date timestamp NOT NULL,
  parsing_status text DEFAULT 'success', -- 'success', 'partial', 'failed'
  content_length integer DEFAULT 0,
  parsing_errors text[],
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Email categories junction table (for future multi-category support)
CREATE TABLE email_categories (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  email_id uuid NOT NULL REFERENCES processed_emails(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  confidence_score real NOT NULL DEFAULT 0.5,
  assigned_at timestamp DEFAULT now(),
  UNIQUE(email_id, category_id)
);

-- Performance indexes
CREATE INDEX idx_processed_emails_category ON processed_emails(category_id);
CREATE INDEX idx_processed_emails_received ON processed_emails(received_date DESC);
CREATE INDEX idx_processed_emails_sender ON processed_emails(sender_email);
CREATE INDEX idx_processed_emails_parsing ON processed_emails(parsing_status);

CREATE INDEX idx_email_assignments_sender ON email_assignments(sender_email);
CREATE INDEX idx_email_assignments_category ON email_assignments(category_id);
CREATE INDEX idx_email_assignments_confidence ON email_assignments(confidence_score DESC);

CREATE INDEX idx_email_categories_email ON email_categories(email_id);
CREATE INDEX idx_email_categories_category ON email_categories(category_id);
CREATE INDEX idx_email_categories_confidence ON email_categories(confidence_score DESC);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_aliases ON contacts USING GIN(aliases);

-- View for emails with categories (for future use)
CREATE OR REPLACE VIEW email_with_categories AS
SELECT 
  pe.*,
  COALESCE(
    json_agg(
      json_build_object(
        'category_id', c.id,
        'category_name', c.name,
        'category_color', c.color,
        'confidence_score', ec.confidence_score
      ) ORDER BY ec.confidence_score DESC
    ) FILTER (WHERE c.id IS NOT NULL), 
    '[]'::json
  ) as categories
FROM processed_emails pe
LEFT JOIN email_categories ec ON pe.id = ec.email_id
LEFT JOIN categories c ON ec.category_id = c.id
GROUP BY pe.id, pe.imap_uid, pe.message_id, pe.sender_email, pe.sender_name, 
         pe.subject, pe.body_text, pe.body_html, pe.category_id, pe.summary, 
         pe.received_date, pe.parsing_status, pe.content_length, pe.parsing_errors, 
         pe.created_at, pe.updated_at;

-- Function to get email summary with better performance
CREATE OR REPLACE FUNCTION get_email_summary()
RETURNS TABLE (
  total bigint,
  unread bigint,
  categories json
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::bigint FROM processed_emails) as total,
    0::bigint as unread,  -- We don't track read status yet
    (
      SELECT json_agg(
        json_build_object(
          'category', json_build_object(
            'id', COALESCE(c.id::text, 'uncategorized'),
            'name', COALESCE(c.name, 'Uncategorized'),
            'description', COALESCE(c.description, 'Emails not yet classified into specific categories'),
            'color', COALESCE(c.color, '#64748b')
          ),
          'count', category_counts.count,
          'unread', 0
        ) ORDER BY category_counts.count DESC
      )
      FROM (
        -- Count emails with categories (using primary category_id for speed)
        SELECT 
          c.id,
          c.name,
          c.description,
          c.color,
          COUNT(pe.id)::int as count
        FROM categories c
        INNER JOIN processed_emails pe ON c.id = pe.category_id
        GROUP BY c.id, c.name, c.description, c.color
        
        UNION ALL
        
        -- Count uncategorized emails
        SELECT 
          NULL as id,
          'Uncategorized' as name,
          'Emails not yet classified into specific categories' as description,
          '#64748b' as color,
          COUNT(*)::int as count
        FROM processed_emails pe 
        WHERE pe.category_id IS NULL
      ) category_counts
      WHERE category_counts.count > 0
    ) as categories;
END;
$$ LANGUAGE plpgsql;

-- Insert default categories to get started
INSERT INTO categories (name, description, color) VALUES
  ('Dịch vụ đang sử dụng', 'Netflix, ChatGPT, YouTube, Kaggle, MongoDB - các email thông báo hóa đơn và cảnh báo sử dụng', '#3B82F6'),
  ('Công việc', 'Email liên quan đến viêc thi cử, dự án, cuộc họp, meeting, báo cáo từ đồng nghiệp và sếp', '#10B981'),
  ('Khuyến mãi & Quảng cáo', 'Email marketing, khuyến mãi, giảm giá từ các shop, thương hiệu, newsletter', '#F59E0B'),
  ('Tài chính & Ngân hàng', 'Thông báo giao dịch, sao kê, lãi suất từ ngân hàng, ví điện tử, thẻ tín dụng', '#EF4444'),
  ('Nhà trường', 'Những thông báo và mail được gửi từ các mail có chữ ptnk, Phổ thông Năng khiếu, ... trong nội dung', '#FBBF24');

-- Function to clean up old emails (optional - for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_emails(days_to_keep integer DEFAULT 90)
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete emails older than specified days
  DELETE FROM processed_emails 
  WHERE received_date < (now() - interval '1 day' * days_to_keep);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Clean up orphaned email_categories
  DELETE FROM email_categories 
  WHERE email_id NOT IN (SELECT id FROM processed_emails);
  
  -- Clean up old email_assignments for senders with no recent emails
  DELETE FROM email_assignments 
  WHERE sender_email NOT IN (
    SELECT DISTINCT sender_email 
    FROM processed_emails 
    WHERE received_date > (now() - interval '30 days')
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Performance optimization: Automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-updating timestamps
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processed_emails_updated_at BEFORE UPDATE ON processed_emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drafts_updated_at BEFORE UPDATE ON drafts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (for RLS if needed later)
-- ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE email_assignments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE processed_emails ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE email_categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

-- Example policies (uncomment if you enable RLS)
-- CREATE POLICY "Allow all operations" ON categories FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON contacts FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON email_assignments FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON processed_emails FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON email_categories FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON drafts FOR ALL USING (true);
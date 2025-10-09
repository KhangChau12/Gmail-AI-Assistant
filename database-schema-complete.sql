-- Gmail Assistant Complete Database Schema
-- This file creates all necessary tables for the Gmail Assistant application
-- including the new AI email composition chat features

-- Drop existing objects with CASCADE to handle dependencies
DROP VIEW IF EXISTS active_composition_sessions CASCADE;
DROP VIEW IF EXISTS category_stats CASCADE;
DROP VIEW IF EXISTS email_summary CASCADE;
DROP VIEW IF EXISTS email_with_categories CASCADE;

-- Drop tables in correct order to handle foreign key constraints
DROP TABLE IF EXISTS composition_chat_messages CASCADE;
DROP TABLE IF EXISTS ai_suggestions CASCADE;
DROP TABLE IF EXISTS composition_sessions CASCADE;
DROP TABLE IF EXISTS drafts CASCADE;
DROP TABLE IF EXISTS email_assignments CASCADE;
DROP TABLE IF EXISTS email_categories CASCADE;
DROP TABLE IF EXISTS processed_emails CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;

-- Drop any existing functions
DROP FUNCTION IF EXISTS update_timestamp() CASCADE;

-- Categories table - Email classification categories
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#64748b',
  gmail_label VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Contacts table - Email contacts and aliases
CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  email VARCHAR(500) NOT NULL UNIQUE,
  aliases JSONB NOT NULL DEFAULT '[]', -- JSON array of alias strings
  category VARCHAR(255),
  notes TEXT,
  extracted_from_email BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Processed emails table - Core email data
CREATE TABLE processed_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imap_uid VARCHAR(255) NOT NULL UNIQUE,
  message_id VARCHAR(500),
  sender_email VARCHAR(500),
  sender_name VARCHAR(500),
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  category_id UUID,
  summary TEXT,
  received_date TIMESTAMP,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  parsing_status VARCHAR(20) DEFAULT 'success' CHECK (parsing_status IN ('success', 'failed', 'partial')),
  content_length INTEGER,
  parsing_errors JSONB, -- JSON array of error messages
  last_reprocessed TIMESTAMP,
  is_read BOOLEAN NOT NULL DEFAULT false, -- Track email read status
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Email assignments table - Manual/automatic category assignments
CREATE TABLE email_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_email VARCHAR(500) NOT NULL,
  sender_name VARCHAR(500),
  category_id UUID NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Composition sessions table - Track email composition sessions
CREATE TABLE composition_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID,
  reply_to_message_id VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Drafts table - Email drafts with session support
CREATE TABLE drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to_email VARCHAR(500) NOT NULL,
  to_name VARCHAR(500),
  subject TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  reply_to_message_id VARCHAR(500),
  session_id UUID,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES composition_sessions(id) ON DELETE SET NULL
);

-- Add foreign key constraint for composition_sessions after drafts table is created
ALTER TABLE composition_sessions ADD CONSTRAINT fk_composition_sessions_draft 
  FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE SET NULL;

-- Composition chat messages table - AI chat conversation history
CREATE TABLE composition_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  suggested_subject TEXT,
  suggested_body TEXT,
  suggestion_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES composition_sessions(id) ON DELETE CASCADE
);

-- AI suggestions table - Track AI suggestion effectiveness
CREATE TABLE ai_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  message_id UUID NOT NULL,
  suggestion_type VARCHAR(20) NOT NULL CHECK (suggestion_type IN ('subject', 'body', 'tone', 'grammar', 'template')),
  original_content TEXT,
  suggested_content TEXT NOT NULL,
  applied BOOLEAN NOT NULL DEFAULT false,
  user_feedback VARCHAR(20), -- 'accepted', 'rejected', 'modified'
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES composition_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES composition_chat_messages(id) ON DELETE CASCADE
);

-- Email templates table - Store commonly used email patterns
CREATE TABLE email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  subject_template TEXT,
  body_template TEXT NOT NULL,
  category VARCHAR(50), -- 'formal', 'casual', 'business', 'personal', etc.
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_processed_emails_sender ON processed_emails(sender_email);
CREATE INDEX idx_processed_emails_category ON processed_emails(category_id);
CREATE INDEX idx_processed_emails_received_date ON processed_emails(received_date);
CREATE INDEX idx_processed_emails_imap_uid ON processed_emails(imap_uid);
CREATE INDEX idx_processed_emails_is_read ON processed_emails(is_read);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_name ON contacts(name);

CREATE INDEX idx_email_assignments_sender ON email_assignments(sender_email);
CREATE INDEX idx_email_assignments_category ON email_assignments(category_id);

CREATE INDEX idx_drafts_session ON drafts(session_id);
CREATE INDEX idx_drafts_created_at ON drafts(created_at);

CREATE INDEX idx_composition_sessions_created_at ON composition_sessions(created_at);
CREATE INDEX idx_composition_sessions_draft ON composition_sessions(draft_id);

CREATE INDEX idx_composition_chat_messages_session ON composition_chat_messages(session_id);
CREATE INDEX idx_composition_chat_messages_created_at ON composition_chat_messages(created_at);

CREATE INDEX idx_ai_suggestions_session ON ai_suggestions(session_id);
CREATE INDEX idx_ai_suggestions_applied ON ai_suggestions(applied);
CREATE INDEX idx_ai_suggestions_type ON ai_suggestions(suggestion_type);

CREATE INDEX idx_email_templates_category ON email_templates(category);
CREATE INDEX idx_email_templates_usage ON email_templates(usage_count);

-- Insert default categories (5 actual categories from your system)
INSERT INTO categories (name, description, color) VALUES
('Dịch vụ đang sử dụng', 'Netflix, ChatGPT, YouTube, Kaggle, MongoDB - các email thông báo hóa đơn và cảnh báo sử dụng', '#3B82F6'),
('Công việc', 'Email liên quan đến viêc thi cử, dự án, cuộc họp, meeting, báo cáo từ đồng nghiệp và sếp', '#10B981'),
('Khuyến mãi & Quảng cáo', 'Email marketing, khuyến mãi, giảm giá từ các shop, thương hiệu, newsletter', '#F59E0B'),
('Tài chính & Ngân hàng', 'Thông báo giao dịch, sao kê, lãi suất từ ngân hàng, ví điện tử, thẻ tín dụng', '#EF4444'),
('Nhà trường', 'Những thông báo và mail được gửi từ các mail có chữ ptnk, Phổ thông Năng khiếu, ... trong nội dung', '#FBBF24');

-- Insert default email templates
INSERT INTO email_templates (name, description, subject_template, body_template, category) VALUES
('Cảm ơn chuyên nghiệp', 'Email cảm ơn cho môi trường công việc', 'Cảm ơn về {topic}', 'Chào {name},

Tôi muốn gửi lời cảm ơn chân thành về {topic}. 

{content}

Xin chân thành cảm ơn.

Trân trọng,
{sender_name}', 'formal'),

('Mời họp', 'Mẫu email mời tham gia cuộc họp', 'Mời họp: {meeting_topic}', 'Chào {name},

Tôi muốn mời bạn tham gia cuộc họp về {meeting_topic}.

Thời gian: {date_time}
Địa điểm: {location}
Link tham gia: {meeting_link}

Nội dung chính:
{agenda}

Vui lòng xác nhận tham dự.

Trân trọng,
{sender_name}', 'business'),

('Theo dõi dự án', 'Email theo dõi tiến độ công việc', 'Cập nhật về {project}', 'Chào {name},

Tôi muốn cập nhật tình hình về {project}.

{status_update}

Bước tiếp theo:
{next_steps}

Nếu có thắc mắc, vui lòng liên hệ.

Trân trọng,
{sender_name}', 'business'),

('Xin lỗi', 'Email xin lỗi lịch sự', 'Xin lỗi về {issue}', 'Chào {name},

Tôi viết email này để xin lỗi về {issue}.

{explanation}

Để khắc phục, chúng tôi sẽ:
{solution}

Xin chân thành xin lỗi về bất tiện này.

Trân trọng,
{sender_name}', 'formal');

-- Create functions and triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_timestamp 
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_contacts_timestamp 
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_drafts_timestamp 
    BEFORE UPDATE ON drafts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_composition_sessions_timestamp 
    BEFORE UPDATE ON composition_sessions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_email_templates_timestamp 
    BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Create view for email summary statistics
CREATE VIEW email_summary AS
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN received_date > (CURRENT_TIMESTAMP - INTERVAL '24 hours') THEN 1 END) as today,
  COUNT(CASE WHEN received_date > (CURRENT_TIMESTAMP - INTERVAL '7 days') THEN 1 END) as this_week,
  COUNT(CASE WHEN category_id IS NULL THEN 1 END) as uncategorized
FROM processed_emails;

-- Create view for category statistics
CREATE VIEW category_stats AS
SELECT 
  c.id,
  c.name,
  c.description,
  c.color,
  COUNT(pe.id) as total_emails,
  COUNT(CASE WHEN pe.received_date > (CURRENT_TIMESTAMP - INTERVAL '7 days') THEN 1 END) as recent_emails
FROM categories c
LEFT JOIN processed_emails pe ON c.id = pe.category_id
GROUP BY c.id, c.name, c.description, c.color;

-- Create view for active composition sessions
CREATE VIEW active_composition_sessions AS
SELECT 
  cs.*,
  d.subject as draft_subject,
  d.to_email as draft_to_email,
  COUNT(ccm.id) as message_count,
  MAX(ccm.created_at) as last_message_at
FROM composition_sessions cs
LEFT JOIN drafts d ON cs.draft_id = d.id
LEFT JOIN composition_chat_messages ccm ON cs.id = ccm.session_id
WHERE cs.created_at > (CURRENT_TIMESTAMP - INTERVAL '1 day') -- Active sessions from last day
GROUP BY cs.id, cs.draft_id, cs.reply_to_message_id, cs.created_at, cs.updated_at, d.subject, d.to_email
ORDER BY cs.updated_at DESC;

-- Create the email summary function with proper unread count
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
    (SELECT COUNT(*)::bigint FROM processed_emails WHERE is_read = false) as unread,  -- Proper unread count
    (
      SELECT COALESCE(json_agg(
        json_build_object(
          'category', json_build_object(
            'id', COALESCE(category_counts.id::text, 'uncategorized'),
            'name', COALESCE(category_counts.name, 'Uncategorized'),
            'description', COALESCE(category_counts.description, 'Emails not yet classified into specific categories'),
            'color', COALESCE(category_counts.color, '#64748b')
          ),
          'count', category_counts.count,
          'percentage', ROUND(
            CASE
              WHEN (SELECT COUNT(*) FROM processed_emails) > 0
              THEN (category_counts.count::numeric / (SELECT COUNT(*) FROM processed_emails)::numeric) * 100
              ELSE 0
            END, 1
          )
        ) ORDER BY category_counts.count DESC
      ), '[]'::json)
      FROM (
        SELECT
          c.id,
          c.name,
          c.description,
          c.color,
          COUNT(pe.id) as count
        FROM categories c
        LEFT JOIN processed_emails pe ON pe.category_id = c.id
        GROUP BY c.id, c.name, c.description, c.color
        UNION ALL
        SELECT
          NULL as id,
          'Uncategorized' as name,
          'Emails not yet classified into specific categories' as description,
          '#64748b' as color,
          COUNT(pe.id) as count
        FROM processed_emails pe
        WHERE pe.category_id IS NULL
        HAVING COUNT(pe.id) > 0
      ) as category_counts
    ) as categories;
END;
$$ LANGUAGE plpgsql;

-- Create helper functions for email read status management
CREATE OR REPLACE FUNCTION update_email_read_status(
  p_imap_uid TEXT,
  p_is_read BOOLEAN
) RETURNS VOID AS $$
BEGIN
  UPDATE processed_emails
  SET is_read = p_is_read
  WHERE imap_uid = p_imap_uid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION bulk_update_email_read_status(
  p_imap_uids TEXT[],
  p_is_read BOOLEAN
) RETURNS VOID AS $$
BEGIN
  UPDATE processed_emails
  SET is_read = p_is_read
  WHERE imap_uid = ANY(p_imap_uids);
END;
$$ LANGUAGE plpgsql;

-- Schema setup complete
-- This schema supports both SQLite (with Better-SQLite3) and PostgreSQL
-- Now includes proper email read status tracking
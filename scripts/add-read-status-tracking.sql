-- Add read status tracking to processed_emails table
-- This fixes the issue where all emails appear as already read

-- Step 1: Add is_read column to processed_emails table
ALTER TABLE processed_emails
ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Add index for better performance on read status queries
CREATE INDEX IF NOT EXISTS idx_processed_emails_is_read ON processed_emails(is_read);

-- Step 3: Update the get_email_summary function to properly count unread emails
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
    (SELECT COUNT(*)::bigint FROM processed_emails WHERE is_read = false) as unread,  -- Now properly tracking unread emails
    (
      SELECT COALESCE(json_agg(
        json_build_object(
          'category', json_build_object(
            'id', COALESCE(c.id::text, 'uncategorized'),
            'name', COALESCE(c.name, 'Uncategorized'),
            'description', COALESCE(c.description, 'Emails not yet classified into specific categories'),
            'color', COALESCE(c.color, '#64748b')
          ),
          'count', category_counts.count,
          'percentage', ROUND(
            CASE
              WHEN (SELECT COUNT(*) FROM processed_emails) > 0
              THEN (category_counts.count::float / (SELECT COUNT(*) FROM processed_emails)::float) * 100
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

-- Step 4: Create a function to update read status of emails
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

-- Step 5: Create a function to mark multiple emails as read/unread
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

-- Step 6: Update existing emails with read status based on common assumptions
-- (New emails from last 24 hours are likely unread, older ones likely read)
UPDATE processed_emails
SET is_read = CASE
  WHEN received_date > NOW() - INTERVAL '24 hours' THEN false
  ELSE true
END
WHERE is_read IS NULL OR is_read = false;

COMMENT ON COLUMN processed_emails.is_read IS 'Tracks whether the email has been read by the user';
COMMENT ON FUNCTION get_email_summary() IS 'Returns email statistics including proper unread count';
COMMENT ON FUNCTION update_email_read_status(TEXT, BOOLEAN) IS 'Updates read status for a single email by IMAP UID';
COMMENT ON FUNCTION bulk_update_email_read_status(TEXT[], BOOLEAN) IS 'Updates read status for multiple emails by IMAP UIDs';
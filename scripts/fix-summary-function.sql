-- Fix the get_email_summary function SQL syntax error
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
            'id', COALESCE(category_counts.id::text, 'uncategorized'),
            'name', COALESCE(category_counts.name, 'Uncategorized'),
            'description', COALESCE(category_counts.description, 'Emails not yet classified into specific categories'),
            'color', COALESCE(category_counts.color, '#64748b')
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
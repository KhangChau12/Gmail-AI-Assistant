#!/usr/bin/env node

/**
 * Script to clean up email data in the database
 * This will update emails with empty content and fix hardcoded summaries
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupEmailData() {
  try {
    console.log('Starting email data cleanup...');

    // 1. Find emails with empty content
    const { data: emptyEmails, error: emptyError } = await supabase
      .from('processed_emails')
      .select('*')
      .or('body_text.is.null,body_text.eq.,body_html.is.null,body_html.eq.');

    if (emptyError) {
      throw emptyError;
    }

    console.log(`Found ${emptyEmails?.length || 0} emails with empty content`);

    // Update their summaries
    for (const email of emptyEmails || []) {
      if (email.summary !== 'Email không có nội dung để tóm tắt.') {
        await supabase
          .from('processed_emails')
          .update({ summary: 'Email không có nội dung để tóm tắt.' })
          .eq('id', email.id);
        
        console.log(`Updated summary for email ${email.id}`);
      }
    }

    // 2. Find emails with the hardcoded summary
    const { data: hardcodedEmails, error: hardcodedError } = await supabase
      .from('processed_emails')
      .select('*')
      .eq('summary', 'Email thông báo về việc thay đổi lịch họp vào thứ Sáu tuần này.');

    if (hardcodedError) {
      throw hardcodedError;
    }

    console.log(`Found ${hardcodedEmails?.length || 0} emails with hardcoded summary`);

    // Clear or fix their summaries
    for (const email of hardcodedEmails || []) {
      const hasContent = email.body_text?.trim() || email.body_html?.trim();
      const newSummary = hasContent ? 
        'Cần tóm tắt lại email này.' : 
        'Email không có nội dung để tóm tắt.';
      
      await supabase
        .from('processed_emails')
        .update({ summary: newSummary })
        .eq('id', email.id);
      
      console.log(`Fixed hardcoded summary for email ${email.id}`);
    }

    // 3. Count total emails needing attention
    const { data: allEmails, error: allError } = await supabase
      .from('processed_emails')
      .select('id, summary, body_text, body_html')
      .limit(1000);

    if (allError) {
      throw allError;
    }

    const stats = {
      total: allEmails?.length || 0,
      emptyContent: 0,
      needsResummary: 0,
      hasContent: 0
    };

    for (const email of allEmails || []) {
      const hasContent = email.body_text?.trim() || email.body_html?.trim();
      
      if (!hasContent) {
        stats.emptyContent++;
      } else if (email.summary === 'Cần tóm tắt lại email này.' || 
                 email.summary === 'Không thể tóm tắt email này.') {
        stats.needsResummary++;
      } else {
        stats.hasContent++;
      }
    }

    console.log('\n=== Cleanup Summary ===');
    console.log(`Total emails: ${stats.total}`);
    console.log(`Emails with no content: ${stats.emptyContent}`);
    console.log(`Emails needing re-summary: ${stats.needsResummary}`);
    console.log(`Emails with content and summary: ${stats.hasContent}`);
    console.log('\nCleanup completed successfully!');

  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupEmailData();
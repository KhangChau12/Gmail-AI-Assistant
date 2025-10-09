#!/usr/bin/env node

/**
 * Fixed Database Setup Script for Gmail AI Assistant
 * This uses the correct approach for Supabase database setup
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration in .env file');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('🚀 Setting up Gmail AI Assistant database...\n');

  try {
    console.log('📝 Testing connection and checking tables...');
    
    // Test connection by checking if categories table exists
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .limit(1);

    if (error && error.message.includes('relation "categories" does not exist')) {
      console.log('❌ Database tables do not exist.');
      console.log('\n📋 MANUAL SETUP REQUIRED:');
      console.log('Please run the schema manually in Supabase SQL Editor.');
      console.log('\n🔗 Steps:');
      console.log('   1. Go to https://supabase.com/dashboard');
      console.log('   2. Open your project');
      console.log('   3. Navigate to SQL Editor');
      console.log('   4. Copy and run the SQL from scripts/schema.sql');
      console.log('\n💡 After running the schema, the tables will be created automatically.');
      return;
    } else if (error) {
      throw error;
    }

    console.log('✅ Database tables exist!');

    // Insert default categories
    console.log('\n📦 Setting up default categories...');
    
    const defaultCategories = [
      {
        name: 'Dịch vụ đang sử dụng',
        description: 'Netflix, ChatGPT, YouTube, Kaggle, MongoDB - các email thông báo hóa đơn và cảnh báo sử dụng',
        color: '#3b82f6'
      },
      {
        name: 'Công việc',
        description: 'Email liên quan đến công việc, dự án, meeting, báo cáo từ đồng nghiệp và sếp',
        color: '#10b981'
      },
      {
        name: 'Khuyến mãi & Quảng cáo',
        description: 'Email marketing, khuyến mãi, giảm giá từ các shop, thương hiệu, newsletter',
        color: '#f59e0b'
      },
      {
        name: 'Tài chính & Ngân hàng',
        description: 'Thông báo giao dịch, sao kê, lãi suất từ ngân hàng, ví điện tử, thẻ tín dụng',
        color: '#ef4444'
      }
    ];

    // Check existing categories first
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('name');

    const existingNames = existingCategories?.map(cat => cat.name) || [];

    for (const category of defaultCategories) {
      if (existingNames.includes(category.name)) {
        console.log(`   ⚠️  Category "${category.name}" already exists - skipping`);
        continue;
      }

      const { error: insertError } = await supabase
        .from('categories')
        .insert([category]);
      
      if (insertError) {
        console.warn(`   ❌ Could not insert category "${category.name}": ${insertError.message}`);
      } else {
        console.log(`   ✓ Created category: ${category.name}`);
      }
    }

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run: npm run dev');
    console.log('   2. Go to Settings to test Gmail connection');
    console.log('   3. Click "Đồng bộ" to sync your first emails');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n🔧 If tables don\'t exist, please run the schema manually:');
    console.log('   1. Go to Supabase dashboard → SQL Editor');
    console.log('   2. Copy and run the contents of scripts/schema.sql');
    console.log('   3. Run this script again: npm run db:setup');
  }
}

async function main() {
  console.log('Gmail AI Assistant - Database Setup');
  console.log('===================================\n');
  
  console.log('🔗 Testing Supabase connection...');
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Key: ${supabaseKey.substring(0, 20)}...`);
  
  await setupDatabase();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { setupDatabase };
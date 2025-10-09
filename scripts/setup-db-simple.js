#!/usr/bin/env node

/**
 * Simple Database Setup Script for Gmail AI Assistant
 * This script provides manual setup instructions since automatic setup has connection issues
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('Gmail AI Assistant - Database Setup');
console.log('===================================\n');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration in .env file');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

console.log('🔍 Configuration found:');
console.log(`   URL: ${supabaseUrl}`);
console.log(`   Key: ${supabaseKey.substring(0, 20)}...`);
console.log();

// Read the schema file
const schemaPath = path.join(__dirname, 'schema.sql');
let schema;

try {
  schema = fs.readFileSync(schemaPath, 'utf8');
} catch (error) {
  console.error('❌ Could not read schema.sql file');
  process.exit(1);
}

console.log('📋 MANUAL DATABASE SETUP REQUIRED');
console.log();
console.log('Due to connection issues, please set up the database manually:');
console.log();
console.log('🔗 Steps:');
console.log('   1. Go to https://supabase.com/dashboard');
console.log('   2. Open your project or create a new one');
console.log('   3. Navigate to SQL Editor');
console.log('   4. Copy and paste the following SQL:');
console.log();
console.log('='.repeat(80));
console.log(schema);
console.log('='.repeat(80));
console.log();
console.log('   5. Click "RUN" to execute the SQL');
console.log('   6. Your database will be ready!');
console.log();
console.log('🚀 After setting up the database:');
console.log('   1. Run: npm run dev');
console.log('   2. Go to Settings to test Gmail connection');
console.log('   3. Click "Đồng bộ" to sync your first emails');
console.log();
console.log('💡 The SQL schema is also available in: scripts/schema.sql');
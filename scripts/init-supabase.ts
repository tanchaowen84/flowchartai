#!/usr/bin/env tsx

/**
 * Initialize Supabase storage bucket for Infogiph
 *
 * This script creates the necessary storage bucket in Supabase
 * Run with: pnpm tsx scripts/init-supabase.ts
 */

import { config } from 'dotenv';
import { SupabaseProvider } from '../src/storage/provider/supabase';

// Load environment variables
config({ path: '.env.local' });

async function initSupabase() {
  console.log('🚀 Initializing Supabase storage...');

  try {
    // Check if required environment variables are set
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn(
        '⚠️ SUPABASE_SERVICE_ROLE_KEY is not set - bucket creation may fail'
      );
    }

    // Create Supabase provider instance
    const provider = new SupabaseProvider('flowchart-files');

    // Try to create the bucket
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('📦 Creating storage bucket...');
      await provider.createBucket();
      console.log('✅ Storage bucket created successfully!');
    } else {
      console.log(
        '⚠️ Skipping bucket creation - create it manually in Supabase dashboard'
      );
    }

    console.log('\n🎉 Supabase initialization completed!');
    console.log('\nNext steps:');
    console.log(
      '1. Create a bucket named "flowchart-files" in your Supabase dashboard (if not already done)'
    );
    console.log('2. Set the bucket to public');
    console.log('3. Configure Google OAuth in Supabase Auth settings');
    console.log(
      '4. Update your environment variables with real Google OAuth credentials'
    );
  } catch (error) {
    console.error('❌ Failed to initialize Supabase:', error);
    process.exit(1);
  }
}

// Run the initialization
initSupabase();

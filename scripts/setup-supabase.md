# Supabase Setup Guide

This guide will help you configure Supabase for Infogiph deployment on Vercel.

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create an account
2. Click "New Project"
3. Choose your organization and enter:
   - Project name: `flowchart-ai`
   - Database password: (generate a strong password)
   - Region: (choose closest to your users)
4. Click "Create new project"

## 2. Get Your Supabase Credentials

Once your project is created, go to Project Settings > API:

- **Project URL**: Copy the "Project URL" (starts with `https://`)
- **Anon Key**: Copy the "anon public" key
- **Service Role Key**: Copy the "service_role" key (keep this secret)

## 3. Set Up Storage

1. Go to Storage in your Supabase dashboard
2. Click "Create a new bucket"
3. Enter bucket name: `flowchart-files`
4. Set to **Public** (for file sharing)
5. Click "Create bucket"

## 4. Configure Google OAuth

1. Go to Authentication > Providers in your Supabase dashboard
2. Find "Google" and click the toggle to enable it
3. You'll need to create a Google OAuth application:

### Create Google OAuth App:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable the "Google+ API"
4. Go to "Credentials" > "Create Credentials" > "OAuth 2.0 Client IDs"
5. Configure OAuth consent screen if needed
6. For Application type, choose "Web application"
7. Add authorized redirect URIs:
   - `https://your-supabase-project.supabase.co/auth/v1/callback`
   - `http://localhost:3000/api/auth/callback/google` (for development)
   - `https://your-vercel-domain.vercel.app/api/auth/callback/google` (for production)

8. Copy the **Client ID** and **Client Secret**

### Configure in Supabase:
1. Back in Supabase, paste the Google Client ID and Client Secret
2. Click "Save"

## 5. Update Environment Variables

Update your `.env.local` file with the Supabase credentials:

```bash
# Supabase (for production and storage)
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Google OAuth (Public)
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id"

# Authentication (Required)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

## 6. Set Up Database Schema (Optional)

If you want to use Supabase as your primary database instead of PostgreSQL, you can:

1. Update your `DATABASE_URL` to use the Supabase PostgreSQL connection string
2. Get it from Project Settings > Database > Connection string (URI format)
3. Run your migrations: `pnpm db:migrate`

## 7. Deploy to Vercel

1. Push your changes to GitHub
2. Connect your repository to Vercel
3. Add the same environment variables to Vercel:
   - Go to Project Settings > Environment Variables
   - Add all the variables from your `.env.local`
4. Deploy!

## 8. Post-Deployment Setup

After deployment:

1. Update your Google OAuth redirect URIs to include your Vercel domain
2. Test the authentication flow
3. Verify file uploads are working with Supabase storage

## Troubleshooting

### Authentication Issues:
- Make sure redirect URIs match exactly in Google Console
- Verify environment variables are set correctly
- Check Supabase logs in the dashboard

### Storage Issues:
- Ensure the bucket is set to public
- Verify bucket name matches in the code
- Check RLS policies if files aren't accessible

### Database Issues:
- Verify connection string format
- Check if migrations ran successfully
- Ensure database is accessible from Vercel's regions
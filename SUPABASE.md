# Supabase Integration for Infogiph

This project now supports Supabase for authentication, storage, and database hosting, making it perfect for deployment on Vercel.

## Features

- ✅ **Hybrid Authentication**: Better Auth with Supabase database support
- ✅ **Supabase Storage**: File uploads and storage using Supabase buckets
- ✅ **Google OAuth**: One-tap login with Google integration
- ✅ **Vercel Ready**: Optimized for Vercel deployment

## Quick Setup

### 1. Environment Variables

Add these to your `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 2. Initialize Supabase

```bash
pnpm init-supabase
```

### 3. Manual Setup

Follow the detailed setup guide in [`scripts/setup-supabase.md`](./scripts/setup-supabase.md)

## Architecture

### Authentication Flow

1. **Better Auth** handles the authentication logic and session management
2. **Supabase** provides the OAuth provider integration and optionally the database
3. **Google One Tap** provides seamless login experience

### Storage Flow

1. Files are uploaded to **Supabase Storage** buckets
2. Public URLs are generated for file access
3. Pre-signed URLs are used for large file uploads

### Database Options

You can choose between:

1. **Local PostgreSQL** (development) + **Supabase** (storage + auth)
2. **Full Supabase** (database + storage + auth)

## Components

### Storage Provider

The `SupabaseProvider` implements the storage interface:

- `uploadFile()` - Direct file upload
- `getPresignedUploadUrl()` - For large files
- `deleteFile()` - Remove files
- `createBucket()` - Initialize storage

### Authentication

- Better Auth configuration with Google OAuth
- Conditional Google One Tap based on environment variables
- Auto-newsletter subscription on signup

## Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Add all environment variables in Vercel dashboard
3. Deploy!

The app will automatically:
- Use Supabase for storage and authentication
- Enable Google OAuth and One Tap login
- Support file uploads and sharing

### Environment Variables for Vercel

Make sure to add these in your Vercel project settings:

```bash
# Database (can be Supabase or external PostgreSQL)
DATABASE_URL="your-database-connection-string"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Authentication
BETTER_AUTH_SECRET="your-random-secret-key"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id"

# AI Service
OPENROUTER_API_KEY="your-openrouter-api-key"

# Base URL (will be set automatically by Vercel)
NEXT_PUBLIC_BASE_URL="https://your-app.vercel.app"
```

## Benefits

### Why Supabase + Better Auth?

1. **Best of Both Worlds**: Better Auth's flexibility with Supabase's infrastructure
2. **Vercel Optimized**: Perfect for serverless deployment
3. **Scalable Storage**: Supabase handles file storage at scale
4. **Google Integration**: Seamless OAuth and One Tap login
5. **Cost Effective**: Supabase free tier is generous for startups

### Migration from S3

The project maintains backward compatibility. You can switch between storage providers by updating:

```typescript
// In src/config/website.tsx
storage: {
  provider: 'supabase', // or 's3'
},
```

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**: Check all variables are set correctly
2. **Google OAuth**: Ensure redirect URIs match exactly
3. **Storage Bucket**: Must be public for file sharing
4. **Database Connection**: Verify Supabase connection string format

### Support

- Check the setup guide: [`scripts/setup-supabase.md`](./scripts/setup-supabase.md)
- Run diagnostics: `pnpm init-supabase`
- View Supabase logs in the dashboard
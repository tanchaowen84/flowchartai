// import { UsersPageClient } from '@/components/admin/users-page';

/**
 * Users page
 *
 * This page is used to manage users for the admin,
 * it is protected and only accessible to the admin role
 *
 * Temporarily disabled due to NextAuth migration type conflicts
 */
export default function UsersPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Admin Users</h1>
      <p className="text-muted-foreground">
        Admin functionality temporarily unavailable during NextAuth migration.
      </p>
    </div>
  );
}

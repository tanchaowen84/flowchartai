'use client';

import { UserAvatar } from '@/components/layout/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAvatarLinks } from '@/config/avatar-config';
import { useLocaleRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { usePaymentStore } from '@/stores/payment-store';
// import type { User } from 'better-auth';
import type { Session } from 'next-auth';

// Define a simplified User type for NextAuth.js
interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}
import { LogOutIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

interface UserButtonProps {
  user: User;
}

export function UserButton({ user }: UserButtonProps) {
  const t = useTranslations();
  const avatarLinks = getAvatarLinks();
  const localeRouter = useLocaleRouter();
  const [open, setOpen] = useState(false);
  const { resetState } = usePaymentStore();

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      console.log('sign out success');
      // Reset payment state on sign out
      resetState();
      localeRouter.replace('/');
    } catch (error: any) {
      console.error('sign out error:', error);
      toast.error(t('Common.logoutFailed'));
    }
  };

  // Desktop View, use DropdownMenu
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger>
        <UserAvatar
          name={user.name ?? ''}
          image={user.image ?? ''}
          className="size-8 border cursor-pointer"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            <p className="font-medium">{user.name ?? ''}</p>
            <p className="w-[200px] truncate text-sm text-muted-foreground">
              {user.email ?? ''}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />

        {avatarLinks.map((item) => (
          <DropdownMenuItem
            key={item.title}
            className="cursor-pointer"
            onClick={() => {
              if (item.href) {
                localeRouter.push(item.href);
              }
            }}
          >
            <div className="flex items-center space-x-2.5">
              {item.icon ? item.icon : null}
              <p className="text-sm">{item.title}</p>
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={async (event) => {
            event.preventDefault();
            setOpen(false);
            handleSignOut();
          }}
        >
          <div className="flex items-center space-x-2.5">
            <LogOutIcon className="size-4" />
            <p className="text-sm">{t('Common.logout')}</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

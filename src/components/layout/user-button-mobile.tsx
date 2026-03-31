'use client';

import { UserAvatar } from '@/components/layout/user-avatar';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { getAvatarLinks } from '@/config/avatar-config';
import { LocaleLink, useLocaleRouter } from '@/i18n/navigation';
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

export function UserButtonMobile({ user }: UserButtonProps) {
  const t = useTranslations();
  const avatarLinks = getAvatarLinks();
  const localeRouter = useLocaleRouter();
  const [open, setOpen] = useState(false);
  const { resetState } = usePaymentStore();

  const closeDrawer = () => {
    setOpen(false);
  };

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

  return (
    <Drawer open={open} onClose={closeDrawer}>
      <DrawerTrigger onClick={() => setOpen(true)}>
        <UserAvatar
          name={user.name ?? ''}
          image={user.image ?? ''}
          className="size-8 border cursor-pointer"
        />
      </DrawerTrigger>
      <DrawerPortal>
        <DrawerOverlay className="fixed inset-0 z-40 bg-background/50" />
        <DrawerContent
          className="fixed inset-x-0 bottom-0 z-50 mt-24 
            overflow-hidden rounded-t-[10px] border bg-background px-3 text-sm"
        >
          <DrawerHeader>
            <DrawerTitle />
          </DrawerHeader>
          <div className="flex items-center justify-start gap-4 p-2">
            <UserAvatar
              name={user.name ?? ''}
              image={user.image ?? ''}
              className="size-8 border cursor-pointer"
            />
            <div className="flex flex-col">
              <p className="font-medium">{user.name ?? ''}</p>
              <p className="w-[200px] truncate text-muted-foreground">
                {user.email ?? ''}
              </p>
            </div>
          </div>

          <ul className="mb-14 mt-1 w-full text-muted-foreground">
            {avatarLinks?.map((item) => (
              <li
                key={item.title}
                className="rounded-lg text-foreground hover:bg-muted"
              >
                <LocaleLink
                  href={item.href || '#'}
                  onClick={closeDrawer}
                  className="flex w-full items-center gap-3 px-2.5 py-2"
                >
                  {item.icon ? item.icon : null}
                  <p className="text-sm">{item.title}</p>
                </LocaleLink>
              </li>
            ))}

            <li
              key="logout"
              className="rounded-lg text-foreground hover:bg-muted"
            >
              <a
                href="#"
                onClick={async (event) => {
                  event.preventDefault();
                  closeDrawer();
                  handleSignOut();
                }}
                className="flex w-full items-center gap-3 px-2.5 py-2"
              >
                <LogOutIcon className="size-4" />
                <p className="text-sm">{t('Common.logout')}</p>
              </a>
            </li>
          </ul>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}

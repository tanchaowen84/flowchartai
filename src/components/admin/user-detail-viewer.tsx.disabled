import { UserAvatar } from '@/components/layout/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { authClient } from '@/lib/auth-client';
import type { User } from '@/lib/auth-types';
import { formatDate } from '@/lib/formatter';
import { cn } from '@/lib/utils';
import { useUsersStore } from '@/stores/users-store';
import {
  CalendarIcon,
  Loader2Icon,
  MailCheckIcon,
  MailQuestionIcon,
  UserRoundCheckIcon,
  UserRoundXIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

interface UserDetailViewerProps {
  user: User;
}

export function UserDetailViewer({ user }: UserDetailViewerProps) {
  const t = useTranslations('Dashboard.admin.users');
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [banReason, setBanReason] = useState(t('ban.defaultReason'));
  const [banExpiresAt, setBanExpiresAt] = useState<Date | undefined>();
  const triggerRefresh = useUsersStore((state) => state.triggerRefresh);

  // show fake data in demo website
  const isDemo = process.env.NEXT_PUBLIC_DEMO_WEBSITE === 'true';

  const handleBan = async () => {
    if (!banReason) {
      setError(t('ban.error'));
      return;
    }

    if (!user.id) {
      setError('User ID is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Admin functionality temporarily disabled - using NextAuth
      console.warn('Admin ban functionality not available with NextAuth');

      toast.success(t('ban.success'));
      // Reset form
      setBanReason('');
      setBanExpiresAt(undefined);
      // Trigger refresh
      triggerRefresh();
    } catch (err) {
      const error = err as Error;
      console.error('Failed to ban user:', error);
      setError(error.message || t('ban.error'));
      toast.error(error.message || t('ban.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnban = async () => {
    if (!user.id) {
      setError('User ID is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Admin functionality temporarily disabled - using NextAuth
      console.warn('Admin unban functionality not available with NextAuth');

      toast.success(t('unban.success'));
      // Trigger refresh
      triggerRefresh();
    } catch (err) {
      const error = err as Error;
      console.error('Failed to unban user:', error);
      setError(error.message || t('unban.error'));
      toast.error(error.message || t('unban.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Drawer direction={isMobile ? 'bottom' : 'right'}>
      <DrawerTrigger asChild>
        <Button
          variant="link"
          className="cursor-pointer text-foreground w-fit px-0 text-left"
        >
          <div className="flex items-center gap-2 pl-3">
            <UserAvatar
              name={user.name ?? ''}
              image={user.image ?? ''}
              className="size-8 border"
            />
            <span className="hover:underline hover:underline-offset-4">
              {user.name ?? user.email ?? 'Unknown User'}
            </span>
          </div>
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <div className="flex items-center gap-4">
            <UserAvatar
              name={user.name ?? ''}
              image={user.image ?? ''}
              className="size-12 border"
            />
            <div>
              <DrawerTitle>{user.name ?? user.email ?? 'Unknown User'}</DrawerTitle>
              <DrawerDescription>{user.email}</DrawerDescription>
            </div>
          </div>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <div className="grid gap-4">
            <div className="flex items-center gap-2">
              {/* role */}
              <Badge
                variant={user.role === 'admin' ? 'default' : 'outline'}
                className="px-1.5"
              >
                {user.role === 'admin' ? t('admin') : t('user')}
              </Badge>
              {/* email verified */}
              <Badge variant="outline" className="px-1.5 hover:bg-accent">
                {user.email ?? 'No email'}
                {/* Email verification status not available with NextAuth */}
                <MailQuestionIcon className="ml-1.5 inline size-4 stroke-yellow-500 dark:stroke-yellow-400" />
              </Badge>

              {/* user banned */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="px-1.5 hover:bg-accent">
                  <UserRoundCheckIcon className="stroke-green-500 dark:stroke-green-400" />
                  {t('active')}
                </Badge>
              </div>
            </div>

            {/* information */}
            <div className="text-muted-foreground">
              {t('joined')}: Unknown
            </div>
            <div className="text-muted-foreground">
              {t('updated')}: Unknown
            </div>
          </div>
          <Separator />

          {/* error */}
          {error && <div className="text-sm text-destructive">{error}</div>}

          {/* ban or unban user - functionality disabled with NextAuth */}
          <div className="grid gap-4">
            <div className="text-muted-foreground">
              User management functionality is not available with NextAuth.
            </div>
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">{t('close')}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

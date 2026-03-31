'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { websiteConfig } from '@/config/website';
import { useLocalePathname, useLocaleRouter } from '@/i18n/navigation';
import { LOCALES, routing } from '@/i18n/routing';
import { authClient } from '@/lib/auth-client';
import { useLocaleStore } from '@/stores/locale-store';
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

// Remove the duplicate interface definition since we've defined the type above
import {
  ChevronsUpDown,
  Languages,
  LaptopIcon,
  LogOut,
  MoonIcon,
  SunIcon,
} from 'lucide-react';
import { type Locale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useParams } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '../layout/user-avatar';

interface SidebarUserProps {
  user: User;
  className?: string;
}

/**
 * User navigation for the dashboard sidebar
 */
export function SidebarUser({ user, className }: SidebarUserProps) {
  const { setTheme } = useTheme();
  const router = useLocaleRouter();
  const { isMobile } = useSidebar();
  const pathname = useLocalePathname();
  const params = useParams();
  const { currentLocale, setCurrentLocale } = useLocaleStore();
  const { resetState } = usePaymentStore();
  const [, startTransition] = useTransition();
  const t = useTranslations();

  const setLocale = (nextLocale: Locale) => {
    setCurrentLocale(nextLocale);

    startTransition(() => {
      router.replace(
        // @ts-expect-error -- TypeScript will validate that only known `params`
        // are used in combination with a given `pathname`. Since the two will
        // always match for the current route, we can skip runtime checks.
        { pathname, params },
        { locale: nextLocale }
      );
    });
  };

  const showModeSwitch = websiteConfig.metadata.mode?.enableSwitch ?? false;
  const showLocaleSwitch = LOCALES.length > 1;

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      console.log('sign out success');
      // Reset payment state on sign out
      resetState();
      router.replace('/');
    } catch (error) {
      console.error('sign out error:', error);
      toast.error(t('Common.logoutFailed'));
    }
  };

  return (
    <SidebarMenu className="border-t pt-4">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="cursor-pointer data-[state=open]:bg-sidebar-accent 
              data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar
                name={user.name ?? ''}
                image={user.image ?? ''}
                className="size-8 border"
              />

              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {user.name || 'User'}
                </span>
                <span className="truncate text-xs">{user.email || ''}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar
                  name={user.name ?? ''}
                  image={user.image ?? ''}
                  className="size-8 border"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {user.name ?? ''}
                  </span>
                  <span className="truncate text-xs">{user.email ?? ''}</span>
                </div>
              </div>
            </DropdownMenuLabel>

            {(showModeSwitch || showLocaleSwitch) && <DropdownMenuSeparator />}

            {showModeSwitch && (
              <DropdownMenuGroup>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer">
                    <LaptopIcon className="mr-2 size-4" />
                    <span>{t('Common.mode.label')}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setTheme('light')}
                    >
                      <SunIcon className="mr-2 size-4" />
                      <span>{t('Common.mode.light')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setTheme('dark')}
                    >
                      <MoonIcon className="mr-2 size-4" />
                      <span>{t('Common.mode.dark')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setTheme('system')}
                    >
                      <LaptopIcon className="mr-2 size-4" />
                      <span>{t('Common.mode.system')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuGroup>
            )}

            {showLocaleSwitch && (
              <DropdownMenuGroup>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer">
                    <Languages className="mr-2 size-4" />
                    <span>{t('Common.language')}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {routing.locales.map((localeOption) => (
                      <DropdownMenuItem
                        key={localeOption}
                        onClick={() => setLocale(localeOption)}
                        className="cursor-pointer"
                      >
                        {websiteConfig.i18n.locales[localeOption].flag && (
                          <span className="mr-2 text-md">
                            {websiteConfig.i18n.locales[localeOption].flag}
                          </span>
                        )}
                        <span className="text-sm">
                          {websiteConfig.i18n.locales[localeOption].name}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuGroup>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="cursor-pointer"
              onClick={async (event) => {
                event.preventDefault();
                handleSignOut();
              }}
            >
              <LogOut className="mr-2 size-4" />
              {t('Common.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

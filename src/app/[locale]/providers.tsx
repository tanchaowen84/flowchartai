'use client';

import { ActiveThemeProvider } from '@/components/layout/active-theme-provider';
import { PaymentProvider } from '@/components/layout/payment-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { websiteConfig } from '@/config/website';
import { RootProvider } from 'fumadocs-ui/provider';
import { ThemeProvider, useTheme } from 'next-themes';
import type { PropsWithChildren } from 'react';

/**
 * Providers
 *
 * This component is used to wrap the app in the providers.
 *
 * - ThemeProvider: Provides the theme to the app.
 * - ActiveThemeProvider: Provides the active theme to the app.
 * - RootProvider: Provides the root provider for Fumadocs UI.
 * - TooltipProvider: Provides the tooltip to the app.
 * - PaymentProvider: Provides the payment state to the app.
 */
export function Providers({ children }: PropsWithChildren) {
  const theme = useTheme();
  const defaultMode = websiteConfig.metadata.mode?.defaultMode ?? 'system';

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={defaultMode}
      enableSystem={true}
      disableTransitionOnChange
    >
      <ActiveThemeProvider>
        <RootProvider theme={theme}>
          <TooltipProvider>
            <PaymentProvider>{children}</PaymentProvider>
          </TooltipProvider>
        </RootProvider>
      </ActiveThemeProvider>
    </ThemeProvider>
  );
}

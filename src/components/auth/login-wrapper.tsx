'use client';

import { useLocaleRouter } from '@/i18n/navigation';
import { Routes } from '@/routes';
import dynamic from 'next/dynamic';
import {
  type MouseEvent,
  type ReactElement,
  cloneElement,
  isValidElement,
  useState,
} from 'react';

const LoginModal = dynamic(
  () =>
    import('@/components/auth/login-modal').then((module) => module.LoginModal),
  { ssr: false }
);

interface LoginWrapperProps {
  children: React.ReactNode;
  mode?: 'modal' | 'redirect';
  asChild?: boolean;
  callbackUrl?: string;
}

export const LoginWrapper = ({
  children,
  mode = 'redirect',
  asChild,
  callbackUrl,
}: LoginWrapperProps) => {
  const router = useLocaleRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLogin = () => {
    // append callbackUrl as a query parameter if provided
    const loginPath = callbackUrl
      ? `${Routes.Login}?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : `${Routes.Login}`;
    console.log('login wrapper, loginPath', loginPath);
    router.push(loginPath);
  };

  if (mode === 'modal') {
    const trigger =
      asChild && isValidElement(children) ? (
        cloneElement(
          children as ReactElement<{
            onClick?: (event: MouseEvent<HTMLElement>) => void;
          }>,
          {
            onClick: (event: MouseEvent<HTMLElement>) => {
              const originalOnClick = (
                children as ReactElement<{
                  onClick?: (event: MouseEvent<HTMLElement>) => void;
                }>
              ).props.onClick;
              originalOnClick?.(event);
              if (!event.defaultPrevented) {
                setIsModalOpen(true);
              }
            },
          }
        )
      ) : (
        <button type="button" onClick={() => setIsModalOpen(true)}>
          {children}
        </button>
      );

    return (
      <>
        {trigger}
        {isModalOpen && (
          <LoginModal
            callbackUrl={callbackUrl}
            open={isModalOpen}
            onOpenChange={setIsModalOpen}
          />
        )}
      </>
    );
  }

  return (
    <span onClick={handleLogin} className="cursor-pointer">
      {children}
    </span>
  );
};

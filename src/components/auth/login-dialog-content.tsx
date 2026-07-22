'use client';

import { LoginForm } from '@/components/auth/login-form';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LoginDialogContentProps {
  callbackUrl?: string;
  title?: string;
  description?: string;
}

export function LoginDialogContent({
  callbackUrl,
  title = 'Continue to your flowchart',
  description = 'Sign in or create a free account to continue.',
}: LoginDialogContentProps) {
  return (
    <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto sm:max-w-[420px]">
      <DialogHeader className="pr-8 text-left">
        <DialogTitle className="text-xl leading-tight">{title}</DialogTitle>
        <DialogDescription className="leading-5">
          {description}
        </DialogDescription>
      </DialogHeader>
      <LoginForm callbackUrl={callbackUrl} embedded />
    </DialogContent>
  );
}

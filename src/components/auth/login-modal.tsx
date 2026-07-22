'use client';

import { LoginDialogContent } from '@/components/auth/login-dialog-content';
import { Dialog } from '@/components/ui/dialog';

interface LoginModalProps {
  callbackUrl?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginModal({
  callbackUrl,
  open,
  onOpenChange,
}: LoginModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <LoginDialogContent callbackUrl={callbackUrl} />
    </Dialog>
  );
}

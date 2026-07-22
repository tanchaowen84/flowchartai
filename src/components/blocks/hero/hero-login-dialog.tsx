'use client';

import { LoginDialogContent } from '@/components/auth/login-dialog-content';
import { Dialog } from '@/components/ui/dialog';

interface HeroLoginDialogProps {
  callbackUrl: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function HeroLoginDialog({
  callbackUrl,
  onOpenChange,
  open,
}: HeroLoginDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <LoginDialogContent
        callbackUrl={callbackUrl}
        title="Continue to your flowchart"
        description="Your input is saved. Sign in or create a free account to continue."
      />
    </Dialog>
  );
}

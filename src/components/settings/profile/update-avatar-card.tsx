'use client';

import { FormError } from '@/components/shared/form-error';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { uploadFileFromBrowser } from '@/storage';
import { User2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface UpdateAvatarCardProps {
  className?: string;
}

/**
 * Update the user's avatar
 */
export function UpdateAvatarCard({ className }: UpdateAvatarCardProps) {
  const t = useTranslations('Dashboard.settings.profile');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | undefined>('');
  const { data: session } = authClient.useSession();
  const [avatarUrl, setAvatarUrl] = useState('');
  const [tempAvatarUrl, setTempAvatarUrl] = useState('');

  useEffect(() => {
    if (session?.user?.image) {
      setAvatarUrl(session.user.image);
    }
  }, [session]);

  const user = session?.user;
  if (!user) {
    return null;
  }

  const handleUploadClick = () => {
    // Create a hidden file input and trigger it
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png, image/jpeg, image/webp';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    };
    input.click();
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setError('');

    try {
      // Create a temporary URL for preview and store the original URL
      const tempUrl = URL.createObjectURL(file);
      setTempAvatarUrl(tempUrl);
      // Show temporary avatar immediately for better UX
      setAvatarUrl(tempUrl);

      // Upload the file to storage
      const result = await uploadFileFromBrowser(file, 'avatars');
      // console.log('uploadFileFromBrowser, result', result);
      const { url } = result;
      console.log('uploadFileFromBrowser, url', url);

      // For Google OAuth, we can't update the user's avatar through our API
      // The avatar is managed by Google
      toast.info(t('avatar.fail'));
      // Restore the Google avatar
      if (session?.user?.image) {
        setAvatarUrl(session.user.image);
      }
    } catch (error) {
      console.error('update avatar error:', error);
      setError(error instanceof Error ? error.message : t('avatar.fail'));
      // Restore the previous avatar if there was an error
      if (session?.user?.image) {
        setAvatarUrl(session.user.image);
      }
      toast.error(t('avatar.fail'));
    } finally {
      setIsUploading(false);
      // Clean up temporary URL
      if (tempAvatarUrl) {
        URL.revokeObjectURL(tempAvatarUrl);
        setTempAvatarUrl('');
      }
    }
  };

  return (
    <Card
      className={cn(
        'w-full max-w-lg md:max-w-xl overflow-hidden py-0 pt-6 flex flex-col',
        className
      )}
    >
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {t('avatar.title')}
        </CardTitle>
        <CardDescription>{t('avatar.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1">
        <div className="flex flex-col items-center sm:flex-row gap-4 sm:gap-8">
          {/* avatar */}
          <Avatar className="h-16 w-16 border">
            <AvatarImage src={avatarUrl ?? ''} alt={user.name ?? ''} />
            <AvatarFallback>
              <User2Icon className="h-8 w-8 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>

          {/* upload button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleUploadClick}
            disabled={isUploading}
            className="cursor-pointer"
          >
            {isUploading ? t('avatar.uploading') : t('avatar.uploadAvatar')}
          </Button>
        </div>

        <FormError message={error} />
      </CardContent>
      <CardFooter className="mt-auto px-6 py-4 flex justify-between items-center bg-background rounded-none">
        <p className="text-sm text-muted-foreground">
          {t('avatar.recommendation')}
        </p>
      </CardFooter>
    </Card>
  );
}

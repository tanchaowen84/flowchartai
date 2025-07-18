import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { AvatarProps } from '@radix-ui/react-avatar';
import { User2Icon } from 'lucide-react';

interface UserAvatarProps extends AvatarProps {
  name: string;
  image: string | null | undefined;
}

/**
 * User avatar component, used in navbar and sidebar
 *
 * @param name - The name of the user
 * @param image - The image of the user
 * @param props - The props of the avatar
 * @returns The user avatar component
 */
export function UserAvatar({ name, image, ...props }: UserAvatarProps) {
  // 确保只有有效的图片URL才传递给src
  const validImageSrc = image && image.trim() !== '' ? image : undefined;

  return (
    <Avatar {...props}>
      <AvatarImage alt={name} title={name} src={validImageSrc} />
      <AvatarFallback>
        <span className="sr-only">{name}</span>
        <User2Icon className="size-4" />
        {/* {getInitials(name)} */}
      </AvatarFallback>
    </Avatar>
  );
}

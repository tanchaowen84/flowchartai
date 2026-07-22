import { cn } from '@/lib/utils';

interface HeaderSectionProps {
  id?: string;
  title?: string;
  titleAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
  titleClassName?: string;
  subtitle?: string;
  subtitleAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
  subtitleClassName?: string;
  description?: string;
  descriptionAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
  descriptionClassName?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * different pages may use this component as different heading style for SEO friendly
 */
export function HeaderSection({
  id,
  title,
  titleAs = 'h2',
  titleClassName,
  subtitle,
  subtitleAs = 'p',
  subtitleClassName,
  description,
  descriptionAs = 'p',
  descriptionClassName,
  className,
  children,
}: HeaderSectionProps) {
  const TitleComponent = titleAs;
  const SubtitleComponent = subtitleAs;
  const DescriptionComponent = descriptionAs;
  return (
    <div
      id={id}
      className={cn('flex flex-col items-center text-center gap-4', className)}
    >
      {title ? (
        <TitleComponent
          className={cn(
            'uppercase tracking-wider text-gradient_indigo-purple font-semibold font-mono max-sm:font-[ui-monospace,SFMono-Regular,Menlo,monospace]',
            titleClassName
          )}
        >
          {title}
        </TitleComponent>
      ) : null}
      {subtitle ? (
        <SubtitleComponent
          className={cn(
            'text-balance text-2xl text-foreground',
            subtitleClassName
          )}
        >
          {subtitle}
        </SubtitleComponent>
      ) : null}
      {description ? (
        <DescriptionComponent
          className={cn(
            'text-balance text-lg text-muted-foreground',
            descriptionClassName
          )}
        >
          {description}
        </DescriptionComponent>
      ) : null}

      {children}
    </div>
  );
}

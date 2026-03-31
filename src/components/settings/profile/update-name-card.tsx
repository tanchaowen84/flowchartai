'use client';

import { FormError } from '@/components/shared/form-error';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

interface UpdateNameCardProps {
  className?: string;
}

/**
 * update user name
 */
export function UpdateNameCard({ className }: UpdateNameCardProps) {
  const t = useTranslations('Dashboard.settings.profile');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>('');
  const { data: session } = authClient.useSession();

  // Create a schema for name validation
  const formSchema = z.object({
    name: z
      .string()
      .min(3, { message: t('name.minLength') })
      .max(30, { message: t('name.maxLength') }),
  });

  // Initialize the form with empty string as fallback if user.name is undefined
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: session?.user?.name || '',
    },
  });

  useEffect(() => {
    if (session?.user?.name) {
      form.setValue('name', session.user.name);
    }
  }, [session, form]);

  // Check if user exists after all hooks are initialized
  const user = session?.user;
  if (!user) {
    return null;
  }

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Don't update if the name hasn't changed
    if (values.name === session?.user?.name) {
      console.log('No changes to save');
      return;
    }

    // For Google OAuth, we can't update the user's name through our API
    // The name is managed by Google
    toast.info(t('name.fail'));
    // Reset the form to the original name
    if (session?.user?.name) {
      form.setValue('name', session.user.name);
    }
  };

  return (
    <Card
      className={cn(
        'w-full max-w-lg md:max-w-xl overflow-hidden pt-6 pb-0 flex flex-col',
        className
      )}
    >
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {t('name.title')}
        </CardTitle>
        <CardDescription>{t('name.description')}</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1"
        >
          <CardContent className="space-y-4 flex-1">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder={t('name.placeholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormError message={error} />
          </CardContent>
          <CardFooter className="mt-6 px-6 py-4 flex justify-between items-center bg-background rounded-none">
            <p className="text-sm text-muted-foreground">{t('name.hint')}</p>

            <Button
              type="submit"
              disabled={isSaving}
              className="cursor-pointer"
            >
              {isSaving ? t('name.saving') : t('name.save')}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

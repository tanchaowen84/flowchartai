'use client';

import type { PricePlan } from '@/payment/types';
import { useTranslations } from 'next-intl';
import { websiteConfig } from './website';

/**
 * Get price plans with translations for client components
 *
 * NOTICE: This function should only be used in client components.
 * If you need to get the price plans in server components, use getAllPricePlans instead.
 * Use this function when showing the pricing table or the billing card to the user.
 *
 * docs:
 * https://mksaas.com/docs/config/price
 *
 * @returns The price plans with translated content
 */
export function getPricePlans(): Record<string, PricePlan> {
  const t = useTranslations('PricePlans');
  const priceConfig = websiteConfig.price;
  const plans: Record<string, PricePlan> = {};

  // Add translated content to each plan
  if (priceConfig.plans.free) {
    plans.free = {
      ...priceConfig.plans.free,
      name: t('free.name'),
      description: t('free.description'),
      features: [
        t('free.features.feature-1'),
        t('free.features.feature-2'),
        t('free.features.feature-3'),
        t('free.features.feature-4'),
      ],
      limits: [
        t('free.limits.limit-1'),
        t('free.limits.limit-2'),
        t('free.limits.limit-3'),
      ],
    };
  }

  if (priceConfig.plans.hobby) {
    plans.hobby = {
      ...priceConfig.plans.hobby,
      name: t('hobby.name'),
      description: t('hobby.description'),
      features: [
        t('hobby.features.feature-1'),
        t('hobby.features.feature-2'),
        t('hobby.features.feature-3'),
        t('hobby.features.feature-4'),
        t('hobby.features.feature-5'),
      ],
      limits: [t('hobby.limits.limit-1'), t('hobby.limits.limit-2')],
    };
  }

  if (priceConfig.plans.professional) {
    plans.professional = {
      ...priceConfig.plans.professional,
      name: t('professional.name'),
      description: t('professional.description'),
      features: [
        t('professional.features.feature-1'),
        t('professional.features.feature-2'),
        t('professional.features.feature-3'),
        t('professional.features.feature-4'),
        t('professional.features.feature-5'),
        t('professional.features.feature-6'),
        t('professional.features.feature-7'),
      ],
      limits: [
        t('professional.limits.limit-1'),
        t('professional.limits.limit-2'),
      ],
    };
  }

  return plans;
}

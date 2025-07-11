import { PaymentTypes, PlanIntervals } from '@/payment/types';
import type { WebsiteConfig } from '@/types';

/**
 * website config, without translations
 *
 * docs:
 * https://mksaas.com/docs/config/website
 */
export const websiteConfig: WebsiteConfig = {
  metadata: {
    theme: {
      defaultTheme: 'default',
      enableSwitch: true,
    },
    mode: {
      defaultMode: 'system',
      enableSwitch: true,
    },
    images: {
      ogImage: 'https://cdn.flowchartai.org/static/og.png',
      logoLight: 'https://cdn.flowchartai.org/static/logo.png',
      logoDark: 'https://cdn.flowchartai.org/static/logo-dark.png',
    },
    social: {
      github: 'https://github.com/MkSaaSHQ',
      twitter: 'https://mksaas.link/twitter',
      blueSky: 'https://mksaas.link/bsky',
      discord: 'https://mksaas.link/discord',
      mastodon: 'https://mksaas.link/mastodon',
      linkedin: 'https://mksaas.link/linkedin',
      youtube: 'https://mksaas.link/youtube',
    },
  },
  features: {
    enableDiscordWidget: false,
    enableUpgradeCard: true,
    enableAffonsoAffiliate: false,
    enablePromotekitAffiliate: false,
    enableDocsPage: false,
    enableAIPages: false,
  },
  routes: {
    defaultLoginRedirect: '/dashboard',
  },
  analytics: {
    enableVercelAnalytics: false,
    enableSpeedInsights: false,
  },
  auth: {
    enableGoogleLogin: true,
    enableGithubLogin: false,
  },
  i18n: {
    defaultLocale: 'en',
    locales: {
      en: {
        flag: '🇺🇸',
        name: 'English',
      },
      // zh: {
      //   flag: '🇨🇳',
      //   name: '中文',
      // },
    },
  },
  blog: {
    paginationSize: 6,
    relatedPostsSize: 3,
  },
  mail: {
    provider: 'resend',
    fromEmail: 'FlowChart AI <noreply@flowchartai.net>',
    supportEmail: 'FlowChart AI Support <support@flowchartai.net>',
  },
  newsletter: {
    provider: 'resend',
    autoSubscribeAfterSignUp: true,
  },
  storage: {
    provider: 's3',
  },
  payment: {
    provider: 'creem',
  },
  price: {
    plans: {
      free: {
        id: 'free',
        prices: [],
        isFree: true,
        isLifetime: false,
      },
      // ========== Stripe Configuration (Commented Out) ==========
      // pro: {
      //   id: 'pro',
      //   prices: [
      //     {
      //       type: PaymentTypes.SUBSCRIPTION,
      //       priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY!,
      //       amount: 990,
      //       currency: 'USD',
      //       interval: PlanIntervals.MONTH,
      //     },
      //     {
      //       type: PaymentTypes.SUBSCRIPTION,
      //       priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY!,
      //       amount: 9900,
      //       currency: 'USD',
      //       interval: PlanIntervals.YEAR,
      //     },
      //   ],
      //   isFree: false,
      //   isLifetime: false,
      //   recommended: true,
      // },
      // lifetime: {
      //   id: 'lifetime',
      //   prices: [
      //     {
      //       type: PaymentTypes.ONE_TIME,
      //       priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_LIFETIME!,
      //       amount: 19900,
      //       currency: 'USD',
      //     },
      //   ],
      //   isFree: false,
      //   isLifetime: true,
      // },

      // ========== Creem Configuration ==========
      pro: {
        id: 'pro',
        prices: [
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId: process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_PRO_MONTHLY!,
            amount: 990,
            currency: 'USD',
            interval: PlanIntervals.MONTH,
          },
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId: process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_PRO_YEARLY!,
            amount: 9900,
            currency: 'USD',
            interval: PlanIntervals.YEAR,
          },
        ],
        isFree: false,
        isLifetime: false,
        recommended: true,
      },
      lifetime: {
        id: 'lifetime',
        prices: [
          {
            type: PaymentTypes.ONE_TIME,
            priceId: process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_LIFETIME!,
            amount: 19900,
            currency: 'USD',
          },
        ],
        isFree: false,
        isLifetime: true,
      },
    },
  },
};

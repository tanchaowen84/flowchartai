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
      ogImage: '/og.png',
      logoLight: '/logo.png',
      logoDark: '/logo.png',
    },
    social: {
      github: 'https://github.com/tanchaowen84/flowchartai',
      twitter: 'https://x.com/tanchaowen84',
      discord: 'https://discord.gg/EhuSZNHNQh',
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
    enableGoogleOneTap: false, // 暂时禁用以解决 FedCM 兼容性问题
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
    fromEmail: 'FlowChart AI <noreply@flowchartai.org>',
    supportEmail: 'FlowChart AI Support <support@flowchartai.org>',
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
      hobby: {
        id: 'hobby',
        prices: [
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId:
              process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_HOBBY_MONTHLY || '',
            amount: 800, // $8.00
            currency: 'USD',
            interval: PlanIntervals.MONTH,
          },
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId:
              process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_HOBBY_YEARLY || '',
            amount: 6000, // $60.00
            currency: 'USD',
            interval: PlanIntervals.YEAR,
          },
        ],
        isFree: false,
        isLifetime: false,
        recommended: true,
      },
      professional: {
        id: 'professional',
        prices: [
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId:
              process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_PROFESSIONAL_MONTHLY ||
              '',
            amount: 1200, // $12.00
            currency: 'USD',
            interval: PlanIntervals.MONTH,
          },
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId:
              process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_PROFESSIONAL_YEARLY ||
              '',
            amount: 9600, // $96.00
            currency: 'USD',
            interval: PlanIntervals.YEAR,
          },
        ],
        isFree: false,
        isLifetime: false,
      },
    },
  },
};

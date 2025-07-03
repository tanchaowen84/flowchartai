'use client';

import { LoginWrapper } from '@/components/auth/login-wrapper';
import { CheckoutButton } from '@/components/pricing/create-checkout-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getPricePlans } from '@/config/price-config';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useLocalePathname } from '@/i18n/navigation';
import { formatPrice } from '@/lib/formatter';
import { PaymentTypes } from '@/payment/types';
import { Check } from 'lucide-react';
import { useState } from 'react';

interface LimitContext {
  type: 'daily' | 'monthly';
  nextResetTime?: Date;
  message?: string;
}

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitContext?: LimitContext;
}

export function PricingModal({
  isOpen,
  onClose,
  limitContext,
}: PricingModalProps) {
  const [isYearly, setIsYearly] = useState(false);
  const [currentPlanIndex, setCurrentPlanIndex] = useState(1); // Start with Pro plan
  const currentUser = useCurrentUser();
  const currentPath = useLocalePathname();

  const pricePlans = getPricePlans();
  const plans = Object.values(pricePlans);

  // Get the current plan data
  const currentPlan = plans[currentPlanIndex];

  // Get price for current plan
  const getPrice = (plan: any) => {
    if (plan.isFree) return null;
    return plan.prices.find(
      (price: any) =>
        price.type === PaymentTypes.SUBSCRIPTION &&
        price.interval === (isYearly ? 'year' : 'month')
    );
  };

  const price = getPrice(currentPlan);

  // Format price display
  const formatPriceDisplay = () => {
    if (currentPlan.isFree) {
      return { main: '$0', period: 'forever' };
    }
    if (price) {
      return {
        main: formatPrice(price.amount, price.currency),
        period: isYearly ? 'year' : 'month',
      };
    }
    return { main: 'Contact Us', period: '' };
  };

  const { main: priceMain, period: pricePeriod } = formatPriceDisplay();

  // Format reset time for limit context
  const formatResetTime = (resetTime: Date) => {
    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();

    if (diff <= 0) return 'soon';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 border-0">
        <div className="p-6 space-y-6">
          {/* Limit Context - Simple Reset Time */}
          {limitContext?.nextResetTime && (
            <div className="text-center text-sm text-gray-600 -mt-2 mb-2">
              Your free request resets in{' '}
              {formatResetTime(limitContext.nextResetTime)}
            </div>
          )}
          {/* Billing Toggle */}
          <div className="flex justify-center">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setIsYearly(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  !isYearly
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setIsYearly(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  isYearly
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Yearly
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800 text-xs"
                >
                  Save 20%
                </Badge>
              </button>
            </div>
          </div>

          {/* Plan Selector */}
          <div className="flex justify-center">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              {plans.map((plan, index) => (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => setCurrentPlanIndex(index)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    index === currentPlanIndex
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {plan.name}
                </button>
              ))}
            </div>
          </div>

          {/* Pricing Card */}
          <Card
            className={`relative ${currentPlan.recommended ? 'ring-2 ring-blue-500' : ''}`}
          >
            {/* Badge */}
            {currentPlan.recommended && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-blue-600 text-white">Most Popular</Badge>
              </div>
            )}

            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold">
                {currentPlan.name}
              </CardTitle>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-4xl font-bold">{priceMain}</span>
                {pricePeriod && (
                  <span className="text-gray-600">/{pricePeriod}</span>
                )}
              </div>
              <p className="text-gray-600 text-sm">{currentPlan.description}</p>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Features */}
              <div className="space-y-3">
                {currentPlan.features?.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <div className="pt-4">
                {currentPlan.isFree ? (
                  currentUser ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <LoginWrapper
                      mode="modal"
                      asChild
                      callbackUrl={currentPath}
                    >
                      <Button variant="outline" className="w-full">
                        Get Started Free
                      </Button>
                    </LoginWrapper>
                  )
                ) : price ? (
                  currentUser ? (
                    <CheckoutButton
                      userId={currentUser.id}
                      planId={currentPlan.id}
                      priceId={price.priceId}
                      className="w-full"
                    >
                      Get Started
                    </CheckoutButton>
                  ) : (
                    <LoginWrapper
                      mode="modal"
                      asChild
                      callbackUrl={currentPath}
                    >
                      <Button className="w-full">Get Started</Button>
                    </LoginWrapper>
                  )
                ) : (
                  <Button variant="outline" className="w-full">
                    Contact Sales
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

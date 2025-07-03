'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import { PricingModal } from './pricing-modal';

interface DailyLimitReachedCardProps {
  nextResetTime?: Date;
  onClose?: () => void;
}

export function DailyLimitReachedCard({ nextResetTime, onClose }: DailyLimitReachedCardProps) {
  const [showPricingModal, setShowPricingModal] = useState(false);

  // Calculate time until next reset
  const getTimeUntilReset = () => {
    if (!nextResetTime) return 'tomorrow';
    
    const now = new Date();
    const diff = nextResetTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'now';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const timeUntilReset = getTimeUntilReset();

  return (
    <>
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-lg text-amber-900">Daily Limit Reached</CardTitle>
              <CardDescription className="text-amber-700">
                You've used your free AI request for today
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-100 rounded-lg p-3">
            <Clock className="h-4 w-4" />
            <span>
              Your free request resets in <strong>{timeUntilReset}</strong>
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Don't want to wait? Upgrade to Pro and get:
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-blue-500" />
                <span><strong>500 AI requests</strong> per month</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span><strong>Priority processing</strong> for faster results</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-green-500" />
                <span><strong>Advanced templates</strong> and features</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              onClick={() => setShowPricingModal(true)}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Zap className="h-4 w-4 mr-2" />
              Upgrade to Pro
            </Button>
            
            {onClose && (
              <Button 
                variant="outline" 
                onClick={onClose}
                className="px-4"
              >
                Maybe Later
              </Button>
            )}
          </div>

          <p className="text-xs text-gray-500 text-center">
            Or come back tomorrow for another free request
          </p>
        </CardContent>
      </Card>

      <PricingModal 
        isOpen={showPricingModal} 
        onClose={() => setShowPricingModal(false)} 
      />
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';

const GUEST_USAGE_KEY = 'guest-ai-usage';
const GUEST_USAGE_TIMESTAMP_KEY = 'guest-ai-usage-timestamp';

export interface GuestUsageState {
  hasUsedFreeRequest: boolean;
  canUseAI: boolean;
  usageTimestamp: number | null;
}

export function useGuestAIUsage() {
  const [guestUsage, setGuestUsage] = useState<GuestUsageState>({
    hasUsedFreeRequest: false,
    canUseAI: true,
    usageTimestamp: null,
  });

  // Load guest usage state from localStorage on mount
  useEffect(() => {
    const hasUsed = localStorage.getItem(GUEST_USAGE_KEY) === 'true';
    const timestamp = localStorage.getItem(GUEST_USAGE_TIMESTAMP_KEY);

    setGuestUsage({
      hasUsedFreeRequest: hasUsed,
      // Always allow frontend usage - backend will be the authoritative check
      canUseAI: true,
      usageTimestamp: timestamp ? Number.parseInt(timestamp, 10) : null,
    });
  }, []);

  // Mark guest usage as used (called after successful AI response)
  const markAsUsed = () => {
    const timestamp = Date.now();
    localStorage.setItem(GUEST_USAGE_KEY, 'true');
    localStorage.setItem(GUEST_USAGE_TIMESTAMP_KEY, timestamp.toString());

    setGuestUsage({
      hasUsedFreeRequest: true,
      // Keep canUseAI as true - backend is the authoritative source
      canUseAI: true,
      usageTimestamp: timestamp,
    });
  };

  // Handle guest limit reached (called when backend returns limit error)
  const handleLimitReached = () => {
    const timestamp = Date.now();
    localStorage.setItem(GUEST_USAGE_KEY, 'true');
    localStorage.setItem(GUEST_USAGE_TIMESTAMP_KEY, timestamp.toString());

    setGuestUsage({
      hasUsedFreeRequest: true,
      canUseAI: true, // Keep true, backend is authoritative
      usageTimestamp: timestamp,
    });
  };

  // Reset guest usage (for testing purposes)
  const resetUsage = () => {
    localStorage.removeItem(GUEST_USAGE_KEY);
    localStorage.removeItem(GUEST_USAGE_TIMESTAMP_KEY);

    setGuestUsage({
      hasUsedFreeRequest: false,
      canUseAI: true,
      usageTimestamp: null,
    });
  };

  // Generate a simple browser fingerprint for additional validation
  const getBrowserFingerprint = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Guest fingerprint', 2, 2);
    }

    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvasFingerprint: canvas.toDataURL(),
    };

    // Create a simple hash of the fingerprint
    return btoa(JSON.stringify(fingerprint)).slice(0, 32);
  };

  return {
    ...guestUsage,
    markAsUsed,
    handleLimitReached,
    resetUsage,
    getBrowserFingerprint,
  };
}

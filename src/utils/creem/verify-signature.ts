import { createHmac } from 'crypto';

export function verifyCreemWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Create HMAC SHA256 hash
    const hmac = createHmac('sha256', secret);
    const calculatedSignature = hmac.update(payload).digest('hex');

    // Compare signatures using timing-safe comparison
    return timingSafeEqual(signature, calculatedSignature);
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

// Timing-safe string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

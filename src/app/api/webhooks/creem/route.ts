import { getPaymentProvider } from '@/payment';
import type { CreemProvider } from '@/payment/provider/creem';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // 1. 获取请求数据
    const body = await request.text();
    const headersList = headers();

    // 获取签名头部
    const signature =
      (await headersList).get('creem-signature') ||
      (await headersList).get('x-creem-signature') ||
      (await headersList).get('signature') ||
      (await headersList).get('x-signature') ||
      '';

    // 2. 基础验证
    if (!signature) {
      console.error('❌ Missing signature in headers');
      return new NextResponse('Missing signature', { status: 401 });
    }

    // 2.1. 检查空请求体
    if (!body || body.trim().length === 0) {
      console.warn('⚠️ Empty webhook body received, skipping processing');
      console.warn('  This might be a test request or proxy issue');
      return NextResponse.json({ received: true, skipped: 'empty_body' });
    }

    // 3. 委托给Provider处理
    const provider = getPaymentProvider('creem') as CreemProvider;
    await provider.handleWebhookEvent(body, signature);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new NextResponse('Webhook error', { status: 400 });
  }
}

/** [INPUT] Existing merchant credentials and --apply. [OUTPUT] Versioned yearly products; existing contracts stay immutable. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  BillingPeriod,
  ProductVersionStatus,
  TaxCategory,
  WaffoPancake,
} from '@waffo/pancake-ts';
import { config } from 'dotenv';
config({ path: '.env.production.local' });
const apply = process.argv.includes('--apply');
const env = {
  merchantId: process.env.WAFFO_MERCHANT_ID!,
  privateKey: process.env.WAFFO_PRIVATE_KEY!,
};
const storeId = process.env.WAFFO_STORE_ID!;
const test = new WaffoPancake({
  ...env,
  privateKey: process.env.WAFFO_TEST_PRIVATE_KEY_FILE
    ? readFileSync(process.env.WAFFO_TEST_PRIVATE_KEY_FILE, 'utf8')
    : env.privateKey,
  environment: 'test',
});
const prod = new WaffoPancake({
  ...env,
  privateKey: process.env.WAFFO_PROD_PRIVATE_KEY_FILE
    ? readFileSync(process.env.WAFFO_PROD_PRIVATE_KEY_FILE, 'utf8')
    : env.privateKey,
  environment: 'prod',
});
const query =
  'query($id: String!) { store(id:$id) { id } subscriptionProducts(storeId:$id) { id name billingPeriod status prices { currency priceInfo { amount } } metadata } subscriptionProductGroups(storeId:$id) { id name } }';
async function catalog(client: WaffoPancake): Promise<any> {
  const response = await client.graphql.query<any>({
    query,
    variables: { id: storeId },
  });
  if (response.errors?.length || !response.data?.store)
    throw new Error(JSON.stringify(response.errors));
  return {
    ...response.data.store,
    subscriptionProducts: response.data.subscriptionProducts.map((p: any) => ({
      ...p,
      metadata:
        typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata,
      prices: Object.fromEntries(
        p.prices.map((v: any) => [v.currency, v.priceInfo])
      ),
    })),
    subscriptionProductGroups: response.data.subscriptionProductGroups,
  };
}
async function main(): Promise<void> {
  const preferred = existsSync('docs/paywall/catalog-receipt.json')
    ? JSON.parse(readFileSync('docs/paywall/catalog-receipt.json', 'utf8'))
        .products
    : {};
  const initial = await catalog(test);
  const live = await catalog(prod);
  const receipt: any = {
    environment: 'prod',
    apply,
    storeId,
    previousYearlyProducts: live.subscriptionProducts.filter(
      (p: any) => p.billingPeriod === 'yearly'
    ),
    products: {},
  };
  for (const [key, name, amount, credits] of [
    [
      'starter_year_202610',
      'FlowchartAI Starter Annual · $7/month',
      '84.00',
      2000,
    ],
    ['pro_year_202610', 'FlowchartAI Pro Annual · $15/month', '180.00', 6000],
  ] as const) {
    let product =
      initial.subscriptionProducts.find(
        (p: any) => p.id === preferred[key]?.id
      ) ||
      initial.subscriptionProducts.find(
        (p: any) => p.metadata?.offerKey === key
      );
    if (!product && !apply) {
      receipt.products[key] = { action: 'create', amount };
      continue;
    }
    if (!product)
      ({ product } = await test.subscriptionProducts.create({
        storeId,
        name,
        billingPeriod: BillingPeriod.Yearly,
        prices: { USD: { amount, taxCategory: TaxCategory.SaaS } },
        description: `${credits.toLocaleString()} credits each month. Annual payment $${amount}. Monthly credits expire. Cancel renewal anytime. First purchase: request a refund within 7 days if all purchased credits remain unused.`,
        metadata: { offerKey: key },
      }));
    if (product.prices.USD.amount !== amount)
      throw new Error('Existing versioned product price mismatch');
    if (apply) {
      await test.subscriptionProducts.updateStatus({
        id: product.id,
        status: ProductVersionStatus.Active,
      });
      if (!live.subscriptionProducts.some((p: any) => p.id === product.id))
        await prod.subscriptionProducts.publish({ id: product.id });
    }
    receipt.products[key] = { id: product.id, amount, credits };
  }
  if (apply) {
    // Keep all previous products in their group; no paid contract is changed.
    const group = initial.subscriptionProductGroups.find(
      (g: any) => g.name === 'FlowchartAI plans'
    );
    if (!group) throw new Error('Existing subscription group missing');
    const productIds = Array.from(
      new Set([
        ...initial.subscriptionProducts.map((p: any) => p.id),
        ...Object.values(receipt.products).map((p: any) => p.id),
      ])
    );
    await test.subscriptionProductGroups.update({ id: group.id, productIds });
    const liveGroup = live.subscriptionProductGroups.find(
      (g: any) => g.name === 'FlowchartAI plans'
    );
    if (liveGroup)
      await prod.subscriptionProductGroups.update({
        id: liveGroup.id,
        productIds,
      });
    else await test.subscriptionProductGroups.publish({ id: group.id });
    const selectedIds = new Set(
      Object.values(receipt.products).map((p: any) => p.id)
    );
    const spare = initial.subscriptionProducts.filter(
      (p: any) =>
        ['starter_year_202610', 'pro_year_202610'].includes(
          p.metadata?.offerKey
        ) && !selectedIds.has(p.id)
    );
    // Only retire this task's unpublished-to-the-app duplicate drafts, never sold historical offers.
    for (const p of spare) {
      await test.subscriptionProducts.updateStatus({
        id: p.id,
        status: ProductVersionStatus.Inactive,
      });
      await prod.subscriptionProducts.updateStatus({
        id: p.id,
        status: ProductVersionStatus.Inactive,
      });
    }
    receipt.retiredUnusedDrafts = spare.map((p: any) => p.id);
    const verified = await catalog(prod);
    for (const [key, p] of Object.entries<any>(receipt.products)) {
      const actual = verified.subscriptionProducts.find(
        (row: any) => row.id === p.id
      );
      if (actual?.prices.USD.amount !== p.amount || actual.status !== 'active')
        throw new Error('Published catalog mismatch');
      receipt.products[key].verified = true;
    }
    for (const old of receipt.previousYearlyProducts) {
      const current = verified.subscriptionProducts.find(
        (p: any) => p.id === old.id
      );
      if (current?.prices.USD.amount !== old.prices.USD.amount)
        throw new Error('Historical product price changed');
    }
    receipt.verifiedAt = new Date().toISOString();
  }
  writeFileSync(
    'docs/paywall/catalog-receipt.json',
    JSON.stringify(receipt, null, 2)
  );
  console.log(JSON.stringify(receipt, null, 2));
}
void main();

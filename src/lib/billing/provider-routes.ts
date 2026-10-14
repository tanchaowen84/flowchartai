/** Verified 2026-10-14 from official model endpoint prices, including cached input. Same model IDs; no silent model downgrade. */
export function billingProviderRoute(model: string): Record<string, unknown> {
  if (model === 'deepseek/deepseek-v4-pro')
    return {
      max_price: { prompt: 2, completion: 4 },
      only: [
        'parasail/fp8',
        'streamlake/fp8',
        'gmicloud/fp8',
        'cloudflare',
        'deepinfra/fp8',
        'alibaba/fp8',
        'siliconflow/fp8',
        'novita/fp8',
        'baidu/fp8',
        'azure/us',
      ],
    };
  if (model === 'deepseek/deepseek-v4-flash')
    return {
      max_price: { prompt: 0.2, completion: 0.4 },
      only: [
        'streamlake/fp8',
        'deepinfra/fp8',
        'gmicloud/fp8',
        'venice',
        'digitalocean',
        'siliconflow/fp8',
        'baidu/fp8',
        'alibaba/fp8',
      ],
    };
  return { max_price: { prompt: 0.2, completion: 0.8 } };
}

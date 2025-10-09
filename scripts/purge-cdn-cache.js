#!/usr/bin/env node

/**
 * Cloudflare CDN 缓存清理脚本
 * 使用 Cloudflare API 按 URL 清除缓存，避免手动到控制台逐个 Purge
 */

require('dotenv').config();

const CDN_BASE_URL =
  process.env.STORAGE_PUBLIC_URL || 'https://cdn.flowchartai.org/static';
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function purgeCache({ urls = [], purgeEverything = false }) {
  const endpoint = `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      purgeEverything ? { purge_everything: true } : { files: urls }
    ),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    const errors =
      data.errors
        ?.map((err) => `${err.message} (code ${err.code})`)
        .join('\n  - ') || 'Unknown error';
    throw new Error(`Cloudflare purge failed:\n  - ${errors}`);
  }

  return data;
}

function printUsage() {
  console.log('用法: pnpm purge-cdn [路径或完整URL] ... [--all]');
  console.log(
    '示例: pnpm purge-cdn static/feature1.png static/blocks/demo.png'
  );
  console.log('      pnpm purge-cdn --all  # 清理整个站点缓存');
  console.log(
    '也可以直接传入完整 URL，例如 https://cdn.flowchartai.org/static/feature1.png'
  );
}

async function main() {
  const args = process.argv.slice(2);
  const purgeAllIndex = args.findIndex(
    (arg) => arg === '--all' || arg === '--everything'
  );
  const purgeEverything = purgeAllIndex !== -1;

  if (purgeEverything) {
    args.splice(purgeAllIndex, 1);
  }

  if (!CLOUDFLARE_ZONE_ID || !CLOUDFLARE_API_TOKEN) {
    console.error(
      '❌ 缺少 CLOUDFLARE_ZONE_ID 或 CLOUDFLARE_API_TOKEN 环境变量'
    );
    console.error('   请在 .env.local 中设置对应的 Cloudflare API 凭证');
    process.exit(1);
  }

  if (!purgeEverything && args.length === 0) {
    console.error('❌ 未提供需要清理的路径');
    console.error('   如果想清理整个缓存，请使用 --all 参数');
    printUsage();
    process.exit(1);
  }

  const urls = purgeEverything
    ? []
    : args.map((arg) => {
        if (/^https?:\/\//i.test(arg)) {
          return arg;
        }

        const normalized = arg.replace(/^\/+/, '');
        if (CDN_BASE_URL.endsWith('/')) {
          return `${CDN_BASE_URL}${normalized}`;
        }
        return `${CDN_BASE_URL}/${normalized}`;
      });

  if (purgeEverything) {
    console.log('🚀 正在请求 Cloudflare 清理整个站点缓存');
  } else {
    console.log('🚀 正在请求 Cloudflare 清理缓存:');
    urls.forEach((url) => console.log(`  • ${url}`));
  }

  try {
    const result = await purgeCache({ urls, purgeEverything });
    const purgedFiles = purgeEverything
      ? ['已请求清理整个缓存']
      : result.result?.files || urls;
    console.log('\n✅ 缓存清理成功');
    console.log('📄 Cloudflare 返回:');
    purgedFiles.forEach((file) => console.log(`  - ${file}`));
  } catch (error) {
    console.error('\n❌ 缓存清理失败');
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { purgeCache };

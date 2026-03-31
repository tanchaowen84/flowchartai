#!/usr/bin/env node

/**
 * CDN 资源测试脚本
 * 验证所有更新的静态资源是否可以通过 CDN 正常访问
 */

const https = require('https');

// CDN 基础 URL
const CDN_BASE_URL = 'https://cdn.infogiph.com/static';

// 测试资源列表（从更新的文件中提取）
const TEST_RESOURCES = [
  // Logo 和基础图片
  'logo.png',
  'favicon.ico',

  // SVG 图标
  'svg/openai.svg',
  'svg/nvidia.svg',
  'svg/github.svg',
  'svg/tailwindcss.svg',
  'svg/lemonsqueezy.svg',

  // 功能演示图片
  'blocks/demo.png',
  'blocks/feature1.png',
  'blocks/feature2.png',
  'blocks/feature3.png',
  'blocks/feature4.png',
  'blocks/howitworks1.png',
  'blocks/ai_capabilities.png',
  'blocks/music.png',
  'blocks/music-light.png',
  'blocks/card.png',
  'blocks/dark-card.webp',
  'blocks/payments.png',
  'blocks/payments-light.png',
  'blocks/origin-cal.png',
  'blocks/origin-cal-dark.png',

  // 头像示例
  'images/avatars/mksaas.png',
];

/**
 * 测试单个资源
 */
function testResource(resourcePath) {
  return new Promise((resolve) => {
    const url = `${CDN_BASE_URL}/${resourcePath}`;

    const request = https.get(url, (response) => {
      const result = {
        path: resourcePath,
        url,
        statusCode: response.statusCode,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length'],
        cacheControl: response.headers['cache-control'],
        cfCacheStatus: response.headers['cf-cache-status'],
        success: response.statusCode === 200,
      };

      // 消费响应数据以避免内存泄漏
      response.on('data', () => {});
      response.on('end', () => {
        resolve(result);
      });
    });

    request.on('error', (error) => {
      resolve({
        path: resourcePath,
        url,
        success: false,
        error: error.message,
      });
    });

    request.setTimeout(10000, () => {
      request.destroy();
      resolve({
        path: resourcePath,
        url,
        success: false,
        error: 'Request timeout',
      });
    });
  });
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (!bytes) return 'Unknown';
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / 1024 ** i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 显示测试结果
 */
function displayResults(results) {
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log('\n📊 测试结果总结:');
  console.log(`✅ 成功: ${successful.length}/${results.length} 个资源`);
  console.log(`❌ 失败: ${failed.length}/${results.length} 个资源`);

  if (successful.length > 0) {
    console.log('\n✅ 成功的资源:');
    successful.forEach((result) => {
      const size = formatSize(result.contentLength);
      const cache = result.cfCacheStatus || 'UNKNOWN';
      console.log(`  ✓ ${result.path} (${size}, ${cache})`);
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ 失败的资源:');
    failed.forEach((result) => {
      console.log(
        `  ✗ ${result.path}: ${result.error || `HTTP ${result.statusCode}`}`
      );
    });
  }

  // 缓存状态统计
  const cacheStats = {};
  successful.forEach((result) => {
    const status = result.cfCacheStatus || 'UNKNOWN';
    cacheStats[status] = (cacheStats[status] || 0) + 1;
  });

  if (Object.keys(cacheStats).length > 0) {
    console.log('\n📈 缓存状态统计:');
    Object.entries(cacheStats).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} 个资源`);
    });
  }

  // 性能建议
  console.log('\n💡 性能建议:');
  if (successful.length === results.length) {
    console.log('  🎉 所有资源都可以正常访问！');
    console.log('  🚀 CDN 配置完全成功');
    console.log('  📈 建议监控缓存命中率以优化性能');
  } else {
    console.log('  ⚠️  部分资源访问失败，请检查：');
    console.log('     1. 资源是否已正确上传到 R2');
    console.log('     2. CDN 域名配置是否正确');
    console.log('     3. 缓存规则是否生效');
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🚀 开始 CDN 资源测试');
  console.log(`📍 CDN 基础 URL: ${CDN_BASE_URL}`);
  console.log(`📋 测试资源数量: ${TEST_RESOURCES.length}\n`);

  const results = [];

  // 并发测试所有资源
  console.log('🔄 正在测试资源...\n');

  const promises = TEST_RESOURCES.map(async (resource, index) => {
    process.stdout.write(
      `[${index + 1}/${TEST_RESOURCES.length}] 测试 ${resource}... `
    );

    const result = await testResource(resource);
    results.push(result);

    if (result.success) {
      console.log('✅');
    } else {
      console.log(`❌ ${result.error || `HTTP ${result.statusCode}`}`);
    }

    return result;
  });

  await Promise.all(promises);

  // 显示结果
  displayResults(results);

  // 返回成功状态
  const allSuccess = results.every((r) => r.success);
  process.exit(allSuccess ? 0 : 1);
}

// 运行测试
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 测试过程中出现错误:', error.message);
    process.exit(1);
  });
}

module.exports = { testResource, TEST_RESOURCES };

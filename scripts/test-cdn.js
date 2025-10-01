#!/usr/bin/env node

/**
 * CDN 配置测试脚本
 * 用于验证 Cloudflare R2 自定义域名配置是否正确
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 测试配置
const CDN_DOMAIN = 'https://cdn.flowchartai.org';
const R2_DOMAIN = 'https://pub-f21064aeeaf740618b140971b64e6024.r2.dev';

// 测试文件列表（从 public 目录选择）
const TEST_FILES = [
  'logo.png',
  'favicon.ico',
  'svg/openai.svg',
  'images/avatars/mksaas.png',
];

/**
 * 测试 HTTP 请求
 */
function testRequest(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          data: data.substring(0, 200), // 只取前200字符
        });
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * 测试现有静态资源
 */
async function testExistingAssets() {
  console.log('🔄 测试现有静态资源访问...');

  const results = [];

  for (const file of TEST_FILES) {
    try {
      // 测试当前 Workers 服务的资源
      const workersUrl = `https://flowchart-ai.tanchaowen84.workers.dev/${file}`;
      console.log(`\n测试文件: ${file}`);
      console.log(`Workers URL: ${workersUrl}`);

      const workersResult = await testRequest(workersUrl);

      results.push({
        file,
        workersUrl,
        workersStatus: workersResult.statusCode,
        workersSuccess: workersResult.statusCode === 200,
      });

      if (workersResult.statusCode === 200) {
        console.log(`✅ Workers 访问成功 (${workersResult.statusCode})`);
      } else {
        console.log(`❌ Workers 访问失败 (${workersResult.statusCode})`);
      }
    } catch (error) {
      console.log(`❌ 测试失败: ${error.message}`);
      results.push({
        file,
        workersSuccess: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * 测试 CDN 域名解析
 */
async function testCDNDomain() {
  console.log('� 测试 CDN 域名解析...');

  try {
    // 测试一个简单的请求到 CDN 域名
    const testUrl = `${CDN_DOMAIN}/favicon.ico`;
    console.log(`测试 URL: ${testUrl}`);

    const result = await testRequest(testUrl);

    if (result.statusCode === 200) {
      console.log('✅ CDN 域名解析成功');
      console.log('响应头:', {
        'cache-control': result.headers['cache-control'],
        'cf-cache-status': result.headers['cf-cache-status'],
        'content-type': result.headers['content-type'],
      });
      return true;
    } else if (result.statusCode === 404) {
      console.log(
        '⚠️  CDN 域名解析成功，但文件未找到 (这是正常的，因为还没迁移)'
      );
      console.log('状态码:', result.statusCode);
      return true; // 域名解析是成功的
    } else {
      console.log('❌ CDN 访问异常');
      console.log('状态码:', result.statusCode);
      console.log('响应内容:', result.data);
      return false;
    }
  } catch (error) {
    if (
      error.message.includes('ENOTFOUND') ||
      error.message.includes('getaddrinfo')
    ) {
      console.log('❌ CDN 域名解析失败 - DNS 配置问题');
      console.log('错误:', error.message);
      return false;
    } else {
      console.log('❌ CDN 访问失败:', error.message);
      return false;
    }
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🚀 开始 CDN 配置测试\n');

  try {
    // 1. 测试现有静态资源（Workers 服务）
    console.log('� 第一步：测试当前 Workers 静态资源服务');
    const assetResults = await testExistingAssets();

    const workersSuccess = assetResults.filter((r) => r.workersSuccess).length;
    console.log(
      `\n📊 Workers 资源测试结果: ${workersSuccess}/${assetResults.length} 成功`
    );

    // 2. 测试 CDN 域名配置
    console.log('\n📋 第二步：测试 CDN 域名配置');
    const cdnDomainSuccess = await testCDNDomain();

    // 3. 总结和建议
    console.log('\n📊 测试结果总结:');
    console.log(
      `当前 Workers 静态资源: ${workersSuccess > 0 ? '✅ 正常' : '❌ 异常'}`
    );
    console.log(`CDN 域名配置: ${cdnDomainSuccess ? '✅ 正常' : '❌ 异常'}`);

    if (cdnDomainSuccess && workersSuccess > 0) {
      console.log('\n🎉 配置检查通过！');
      console.log('💡 下一步: 可以开始将静态资源迁移到 R2');
      console.log('💡 建议: 先迁移小文件（如 SVG 图标）进行测试');
    } else if (!cdnDomainSuccess) {
      console.log('\n⚠️  CDN 域名配置需要检查');
      console.log('💡 请确认:');
      console.log('   1. Cloudflare DNS 中 cdn.flowchartai.org 的 CNAME 记录');
      console.log('   2. R2 bucket 的自定义域名绑定');
      console.log('   3. 域名代理状态（橙色云朵）');
    } else {
      console.log('\n⚠️  Workers 静态资源服务异常');
      console.log('💡 请检查当前部署状态');
    }
  } catch (error) {
    console.error('\n❌ 测试过程中出现错误:', error.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { testCDNDomain, testExistingAssets };

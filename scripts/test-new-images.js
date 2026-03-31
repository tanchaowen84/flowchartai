#!/usr/bin/env node

/**
 * 测试新添加的Landing Page图片是否可以通过CDN正常访问
 */

const https = require('https');

// CDN 基础 URL
const CDN_BASE_URL = 'https://cdn.infogiph.com/static';

// 新添加的图片列表
const NEW_IMAGES = [
  'blocks/demo.png',
  'blocks/feature1.png',
  'blocks/feature2.png',
  'blocks/feature3.png',
  'blocks/feature4.png',
  'blocks/howitworks1.png',
];

/**
 * 测试单个图片
 */
function testImage(imagePath) {
  return new Promise((resolve) => {
    const url = `${CDN_BASE_URL}/${imagePath}`;

    const req = https.get(url, (res) => {
      const { statusCode, headers } = res;

      // 消费响应数据以释放内存
      res.resume();

      resolve({
        path: imagePath,
        url: url,
        success: statusCode === 200,
        statusCode: statusCode,
        contentType: headers['content-type'],
        contentLength: headers['content-length'],
      });
    });

    req.on('error', (error) => {
      resolve({
        path: imagePath,
        url: url,
        success: false,
        error: error.message,
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        path: imagePath,
        url: url,
        success: false,
        error: 'Request timeout',
      });
    });
  });
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (!bytes) return 'Unknown';
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / 1024 ** i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 显示测试结果
 */
function showResults(results) {
  console.log('\n📊 测试结果摘要:');
  console.log('=' * 50);

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ 成功: ${successful.length}/${results.length}`);
  console.log(`❌ 失败: ${failed.length}/${results.length}`);

  if (successful.length > 0) {
    console.log('\n✅ 成功访问的图片:');
    successful.forEach((result) => {
      console.log(
        `   ${result.path} (${formatFileSize(result.contentLength)})`
      );
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ 无法访问的图片:');
    failed.forEach((result) => {
      console.log(
        `   ${result.path}: ${result.error || `HTTP ${result.statusCode}`}`
      );
    });
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🖼️  测试新添加的Landing Page图片CDN访问\n');
  console.log(`CDN 基础 URL: ${CDN_BASE_URL}`);
  console.log(`测试图片数量: ${NEW_IMAGES.length}\n`);

  try {
    console.log('🔄 开始测试...\n');

    const results = [];

    for (let i = 0; i < NEW_IMAGES.length; i++) {
      const imagePath = NEW_IMAGES[i];
      process.stdout.write(
        `[${i + 1}/${NEW_IMAGES.length}] 测试 ${imagePath}... `
      );

      const result = await testImage(imagePath);
      results.push(result);

      if (result.success) {
        console.log(`✅ (${formatFileSize(result.contentLength)})`);
      } else {
        console.log(`❌ ${result.error || `HTTP ${result.statusCode}`}`);
      }
    }

    // 显示结果摘要
    showResults(results);

    const allSuccess = results.every((r) => r.success);

    if (allSuccess) {
      console.log('\n🎉 所有图片都可以正常访问！');
      console.log('💡 Landing Page图片配置完成，可以正常使用');
    } else {
      console.log('\n⚠️  部分图片无法访问');
      console.log('💡 请检查:');
      console.log('   1. 图片是否已上传到 R2 bucket');
      console.log('   2. 图片路径是否正确');
      console.log('   3. CDN 域名配置是否正常');
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

module.exports = { testImage, NEW_IMAGES };

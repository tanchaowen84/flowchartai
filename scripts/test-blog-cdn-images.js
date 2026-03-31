#!/usr/bin/env node

/**
 * 博客CDN图片链接测试脚本
 *
 * 功能：
 * 1. 扫描所有博客文章的CDN图片链接
 * 2. 测试每个链接的可访问性
 * 3. 生成测试报告
 *
 * 使用方法：
 * node scripts/test-blog-cdn-images.js
 */

import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 配置
const CONFIG = {
  paths: {
    blogDir: join(projectRoot, 'content/blog'),
  },
  // 测试超时时间（毫秒）
  timeout: 10000,
};

// 获取所有博客文章
function getAllBlogPosts() {
  const blogFiles = readdirSync(CONFIG.paths.blogDir)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => join(CONFIG.paths.blogDir, file));

  console.log(`📄 找到 ${blogFiles.length} 篇博客文章`);
  return blogFiles;
}

// 解析博客文章的CDN图片
function parseCDNImages(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');

    // 提取 frontmatter 中的 image 字段
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return null;
    }

    const frontmatter = frontmatterMatch[1];
    const imageMatch = frontmatter.match(/^image:\s*(.+)$/m);

    if (!imageMatch) {
      return null;
    }

    const imagePath = imageMatch[1].trim();

    // 只处理CDN图片链接
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return {
        blogFile: filePath,
        cdnPath: imagePath,
        fileName: imagePath.split('/').pop() || 'unknown',
      };
    }

    return null;
  } catch (error) {
    console.error(`❌ 解析 ${filePath} 失败:`, error.message);
    return null;
  }
}

// 测试单个URL是否可访问
async function testUrl(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'FlowChart-AI-CDN-Test/1.0',
      },
    });

    clearTimeout(timeoutId);

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: `请求超时 (${CONFIG.timeout}ms)`,
      };
    }
    return {
      success: false,
      error: error.message,
    };
  }
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (!bytes) return 'Unknown';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

// 主函数
async function main() {
  console.log('🔍 开始测试博客CDN图片链接\n');

  try {
    // 1. 获取所有博客文章
    const blogFiles = getAllBlogPosts();

    // 2. 解析CDN图片
    const cdnImages = [];
    for (const blogFile of blogFiles) {
      const imageInfo = parseCDNImages(blogFile);
      if (imageInfo) {
        cdnImages.push(imageInfo);
      }
    }

    if (cdnImages.length === 0) {
      console.log('📭 没有找到使用CDN的图片链接');
      return;
    }

    console.log(`🖼️  找到 ${cdnImages.length} 个CDN图片链接:\n`);

    // 3. 测试每个CDN链接
    const results = {
      success: [],
      failed: [],
    };

    for (const imageInfo of cdnImages) {
      console.log(`🔗 测试: ${imageInfo.fileName}`);
      console.log(`   ${imageInfo.cdnPath}`);

      const testResult = await testUrl(imageInfo.cdnPath);

      if (testResult.success) {
        console.log(
          `   ✅ 状态: ${testResult.status} ${testResult.statusText}`
        );
        console.log(`   📄 类型: ${testResult.contentType || 'Unknown'}`);
        console.log(`   📏 大小: ${formatFileSize(testResult.contentLength)}`);

        results.success.push({
          ...imageInfo,
          ...testResult,
        });
      } else {
        console.log(
          `   ❌ 失败: ${testResult.error || `HTTP ${testResult.status}`}`
        );

        results.failed.push({
          ...imageInfo,
          error: testResult.error || `HTTP ${testResult.status}`,
        });
      }
      console.log('');
    }

    // 4. 生成报告
    console.log(`📊 测试完成！结果统计:\n`);
    console.log(`✅ 成功: ${results.success.length} 个`);
    console.log(`❌ 失败: ${results.failed.length} 个`);

    if (results.success.length > 0) {
      console.log(`\n✅ 可访问的CDN图片:`);
      results.success.forEach((result) => {
        console.log(`   🖼️  ${result.fileName}`);
        console.log(`   🔗 ${result.cdnPath}`);
        console.log(
          `   📏 ${formatFileSize(result.contentLength)} (${result.contentType})`
        );
        console.log('');
      });
    }

    if (results.failed.length > 0) {
      console.log(`\n❌ 不可访问的图片:`);
      results.failed.forEach((result) => {
        console.log(`   🖼️  ${result.fileName}`);
        console.log(`   🔗 ${result.cdnPath}`);
        console.log(`   ❌ ${result.error}`);
        console.log('');
      });
    }

    // 5. 建议修复方案
    if (results.failed.length > 0) {
      console.log(`💡 修复建议:`);
      console.log(`   1. 确认R2存储桶中存在对应的图片文件`);
      console.log(`   2. 检查CDN域名配置是否正确`);
      console.log(`   3. 验证图片路径是否匹配`);
      console.log(`   4. 可以重新运行上传脚本: npm run upload-blog-images`);
    }

    if (results.success.length === cdnImages.length) {
      console.log(`🎉 所有CDN图片链接都可以正常访问！`);
    }
  } catch (error) {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as testBlogCDNImages };

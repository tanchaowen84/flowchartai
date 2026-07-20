#!/usr/bin/env node

/**
 * 静态资源路径更新脚本
 * 将项目中的静态资源引用路径更新为 CDN 路径
 */

// 加载环境变量
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 配置
const CDN_BASE_URL =
  process.env.STORAGE_PUBLIC_URL || 'https://cdn.flowchartai.org';
const CDN_STATIC_PATH = `${CDN_BASE_URL}/static`;

// 需要处理的文件类型
const FILE_PATTERNS = [
  'src/**/*.tsx',
  'src/**/*.ts',
  'src/**/*.jsx',
  'src/**/*.js',
];

// 需要排除的目录
const EXCLUDE_PATTERNS = [
  'node_modules/**',
  '.next/**',
  'scripts/**',
];

/**
 * 获取所有需要处理的文件
 */
function getFilesToProcess() {
  const files = [];

  for (const pattern of FILE_PATTERNS) {
    const matchedFiles = glob.sync(pattern, {
      ignore: EXCLUDE_PATTERNS,
    });
    files.push(...matchedFiles);
  }

  // 去重
  return [...new Set(files)];
}

/**
 * 检查文件是否包含静态资源引用
 */
function hasStaticAssetReferences(content) {
  // 匹配 src="/xxx" 或 src='/xxx' 的模式
  const patterns = [
    /src=["']\/[^"']*\.(png|jpg|jpeg|gif|webp|svg|ico)["']/gi,
    /src=["']\/[^"']*\.(css|js)["']/gi,
    /href=["']\/[^"']*\.(css|js|ico)["']/gi,
    /url\(["']?\/[^"')]*\.(png|jpg|jpeg|gif|webp|svg|ico)["']?\)/gi,
  ];

  return patterns.some((pattern) => pattern.test(content));
}

/**
 * 更新文件中的静态资源路径
 */
function updateAssetPaths(content) {
  let updatedContent = content;
  let changeCount = 0;

  // 定义替换规则
  const replacements = [
    // Image src 属性
    {
      pattern: /src=["']\/([^"']*\.(png|jpg|jpeg|gif|webp|svg|ico))["']/gi,
      replacement: `src="${CDN_STATIC_PATH}/$1"`,
      description: 'Image src attributes',
    },
    // CSS/JS src 属性
    {
      pattern: /src=["']\/([^"']*\.(css|js))["']/gi,
      replacement: `src="${CDN_STATIC_PATH}/$1"`,
      description: 'CSS/JS src attributes',
    },
    // Link href 属性 (CSS, favicon等)
    {
      pattern: /href=["']\/([^"']*\.(css|js|ico))["']/gi,
      replacement: `href="${CDN_STATIC_PATH}/$1"`,
      description: 'Link href attributes',
    },
    // CSS url() 函数
    {
      pattern:
        /url\(["']?\/([^"')]*\.(png|jpg|jpeg|gif|webp|svg|ico))["']?\)/gi,
      replacement: `url("${CDN_STATIC_PATH}/$1")`,
      description: 'CSS url() functions',
    },
  ];

  // 应用所有替换规则
  for (const rule of replacements) {
    const matches = updatedContent.match(rule.pattern);
    if (matches) {
      updatedContent = updatedContent.replace(rule.pattern, rule.replacement);
      changeCount += matches.length;
    }
  }

  return {
    content: updatedContent,
    changeCount,
    hasChanges: changeCount > 0,
  };
}

/**
 * 处理单个文件
 */
function processFile(filePath) {
  try {
    const originalContent = fs.readFileSync(filePath, 'utf8');

    // 检查是否包含静态资源引用
    if (!hasStaticAssetReferences(originalContent)) {
      return {
        file: filePath,
        processed: false,
        reason: 'No static asset references found',
      };
    }

    // 更新资源路径
    const result = updateAssetPaths(originalContent);

    if (!result.hasChanges) {
      return {
        file: filePath,
        processed: false,
        reason: 'No changes needed',
      };
    }

    // 写入更新后的内容
    fs.writeFileSync(filePath, result.content, 'utf8');

    return {
      file: filePath,
      processed: true,
      changeCount: result.changeCount,
    };
  } catch (error) {
    return {
      file: filePath,
      processed: false,
      error: error.message,
    };
  }
}

/**
 * 显示处理结果摘要
 */
function showSummary(results) {
  const processed = results.filter((r) => r.processed);
  const skipped = results.filter((r) => !r.processed && !r.error);
  const errors = results.filter((r) => r.error);

  console.log('\n📊 处理结果摘要:');
  console.log(`✅ 已处理: ${processed.length} 个文件`);
  console.log(`⏭️  跳过: ${skipped.length} 个文件`);
  console.log(`❌ 错误: ${errors.length} 个文件`);

  if (processed.length > 0) {
    console.log('\n✅ 已处理的文件:');
    processed.forEach((result) => {
      console.log(`  - ${result.file} (${result.changeCount} 处更改)`);
    });
  }

  if (errors.length > 0) {
    console.log('\n❌ 处理失败的文件:');
    errors.forEach((result) => {
      console.log(`  - ${result.file}: ${result.error}`);
    });
  }

  const totalChanges = processed.reduce((sum, r) => sum + r.changeCount, 0);
  console.log(`\n🎉 总计更新了 ${totalChanges} 处静态资源引用`);
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始更新静态资源路径\n');
  console.log(`CDN 基础 URL: ${CDN_BASE_URL}`);
  console.log(`静态资源路径: ${CDN_STATIC_PATH}\n`);

  try {
    // 获取所有需要处理的文件
    console.log('📁 扫描项目文件...');
    const files = getFilesToProcess();
    console.log(`发现 ${files.length} 个文件需要检查\n`);

    // 处理所有文件
    console.log('🔄 开始处理文件...\n');
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      process.stdout.write(`[${i + 1}/${files.length}] 处理 ${file}... `);

      const result = processFile(file);
      results.push(result);

      if (result.processed) {
        console.log(`✅ (${result.changeCount} 处更改)`);
      } else if (result.error) {
        console.log(`❌ ${result.error}`);
      } else {
        console.log('⏭️  跳过');
      }
    }

    // 显示结果摘要
    showSummary(results);

    console.log('\n💡 下一步建议:');
    console.log('1. 检查更新后的文件确保正确性');
    console.log('2. 运行 pnpm build 测试构建');
    console.log('3. 测试页面加载确保资源正常显示');
  } catch (error) {
    console.error('❌ 处理过程中出现错误:', error.message);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = { updateAssetPaths, processFile };

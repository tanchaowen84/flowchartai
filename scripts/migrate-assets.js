#!/usr/bin/env node

/**
 * 静态资源迁移脚本
 * 将 public 目录中的静态资源上传到 Cloudflare R2
 */

// 加载环境变量
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// 配置
const config = {
  region: process.env.STORAGE_REGION || 'auto',
  endpoint: process.env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
  },
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE !== 'false',
};

const bucketName = process.env.STORAGE_BUCKET_NAME;
const publicDir = path.join(__dirname, '../public');

// MIME 类型映射
const mimeTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.xml': 'application/xml',
};

/**
 * 获取文件的 MIME 类型
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * 递归获取目录中的所有文件
 */
function getAllFiles(dir, baseDir = dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      const relativePath = path.relative(baseDir, fullPath);
      files.push({
        localPath: fullPath,
        remotePath: relativePath.replace(/\\/g, '/'), // 确保使用正斜杠
        size: stat.size,
      });
    }
  }

  return files;
}

/**
 * 上传单个文件到 R2
 */
async function uploadFile(s3Client, file) {
  try {
    const fileContent = fs.readFileSync(file.localPath);
    const mimeType = getMimeType(file.localPath);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `static/${file.remotePath}`,
      Body: fileContent,
      ContentType: mimeType,
      CacheControl: getCacheControl(file.remotePath),
    });

    await s3Client.send(command);

    return {
      success: true,
      file: file.remotePath,
      size: file.size,
      mimeType,
    };
  } catch (error) {
    return {
      success: false,
      file: file.remotePath,
      error: error.message,
    };
  }
}

/**
 * 获取缓存控制策略
 */
function getCacheControl(filePath) {
  if (filePath.includes('favicon') || filePath.includes('logo')) {
    return 'public, max-age=86400'; // 1天
  } else if (
    filePath.endsWith('.svg') ||
    filePath.endsWith('.png') ||
    filePath.endsWith('.jpg')
  ) {
    return 'public, max-age=2592000'; // 30天
  } else {
    return 'public, max-age=3600'; // 1小时
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  );
}

/**
 * 主迁移函数
 */
async function main() {
  console.log('🚀 开始静态资源迁移到 R2\n');

  // 检查配置
  if (!bucketName || !config.credentials.accessKeyId) {
    console.error('❌ 缺少必要的环境变量配置');
    console.error('请确保设置了 STORAGE_BUCKET_NAME, STORAGE_ACCESS_KEY_ID 等');
    process.exit(1);
  }

  // 创建 S3 客户端
  const s3Client = new S3Client(config);

  try {
    // 获取所有文件
    console.log('📁 扫描 public 目录...');
    const files = getAllFiles(publicDir);

    console.log(`发现 ${files.length} 个文件`);
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    console.log(`总大小: ${formatSize(totalSize)}\n`);

    // 显示文件列表
    console.log('📋 文件列表:');
    files.forEach((file, index) => {
      console.log(
        `${index + 1}. ${file.remotePath} (${formatSize(file.size)})`
      );
    });

    console.log('\n🔄 开始上传...\n');

    // 上传文件
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      process.stdout.write(
        `[${i + 1}/${files.length}] 上传 ${file.remotePath}... `
      );

      const result = await uploadFile(s3Client, file);
      results.push(result);

      if (result.success) {
        console.log('✅');
        successCount++;
      } else {
        console.log(`❌ ${result.error}`);
        failCount++;
      }
    }

    // 显示结果
    console.log('\n📊 迁移结果:');
    console.log(`✅ 成功: ${successCount} 个文件`);
    console.log(`❌ 失败: ${failCount} 个文件`);

    if (failCount > 0) {
      console.log('\n❌ 失败的文件:');
      results
        .filter((r) => !r.success)
        .forEach((r) => console.log(`  - ${r.file}: ${r.error}`));
    }

    if (successCount > 0) {
      console.log('\n🎉 迁移完成！');
      console.log(
        `💡 现在可以通过 https://cdn.flowchartai.org/static/ 访问这些文件`
      );
      console.log(`💡 例如: https://cdn.flowchartai.org/static/logo.png`);
    }
  } catch (error) {
    console.error('❌ 迁移过程中出现错误:', error.message);
    process.exit(1);
  }
}

// 运行迁移
if (require.main === module) {
  main();
}

module.exports = { uploadFile, getAllFiles };

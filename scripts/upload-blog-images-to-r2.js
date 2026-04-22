#!/usr/bin/env node

/**
 * 博客封面图片上传到 Cloudflare R2 脚本
 *
 * 功能：
 * 1. 扫描所有博客文章的封面图片
 * 2. 上传图片到 Cloudflare R2
 * 3. 更新博客文章中的图片路径为 CDN 地址
 * 4. 生成上传报告
 *
 * 使用方法：
 * node scripts/upload-blog-images-to-r2.js
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 加载环境变量
config({ path: join(__dirname, '../.env') });

// 配置
const CONFIG = {
  // R2 配置
  r2: {
    endpoint: process.env.STORAGE_ENDPOINT,
    region: process.env.STORAGE_REGION || 'auto',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
    bucketName: process.env.STORAGE_BUCKET_NAME,
    publicUrl: process.env.STORAGE_PUBLIC_URL?.replace(/\/$/, ''), // 移除末尾的斜杠
  },
  // 本地路径
  paths: {
    blogDir: join(projectRoot, 'content/blog'),
    blogImagesDir: join(projectRoot, 'public/images/blog'),
  },
  // CDN 路径配置
  cdn: {
    basePath: 'blog/images', // R2 中的基础路径
  },
};

// 验证配置
function validateConfig() {
  const required = [
    'STORAGE_ENDPOINT',
    'STORAGE_ACCESS_KEY_ID',
    'STORAGE_SECRET_ACCESS_KEY',
    'STORAGE_BUCKET_NAME',
    'STORAGE_PUBLIC_URL',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ 缺少必需的环境变量:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('\n请检查 .env 文件或环境变量配置。');
    process.exit(1);
  }

  console.log('✅ 配置验证通过');
  console.log(`📦 R2 Bucket: ${CONFIG.r2.bucketName}`);
  console.log(`🌐 CDN URL: ${CONFIG.r2.publicUrl}`);
  console.log(`📁 本地图片目录: ${CONFIG.paths.blogImagesDir}`);
}

// 获取所有博客文章
function getAllBlogPosts() {
  const blogFiles = readdirSync(CONFIG.paths.blogDir)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => join(CONFIG.paths.blogDir, file));

  console.log(`📄 找到 ${blogFiles.length} 篇博客文章`);
  return blogFiles;
}

// 解析博客文章的封面图片
function parseBlogImage(filePath) {
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
      console.log(`⚠️  ${filePath} 没有封面图片`);
      return null;
    }

    const imagePath = imageMatch[1].trim();

    // 只处理本地图片路径
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      console.log(`🌐 ${filePath} 已使用CDN图片: ${imagePath}`);
      return null;
    }

    // 转换相对路径为绝对路径
    if (imagePath.startsWith('/images/blog/')) {
      const fileName = imagePath.replace('/images/blog/', '');
      const localPath = join(CONFIG.paths.blogImagesDir, fileName);

      if (statSync(localPath).isFile()) {
        return {
          blogFile: filePath,
          frontmatterPath: imagePath,
          localPath: localPath,
          fileName: fileName,
        };
      }
    }

    console.log(`❌ ${filePath} 图片文件不存在: ${imagePath}`);
    return null;
  } catch (error) {
    console.error(`❌ 解析 ${filePath} 失败:`, error.message);
    return null;
  }
}

// 创建 S3 客户端
function createS3Client() {
  return new S3Client({
    endpoint: CONFIG.r2.endpoint,
    region: CONFIG.r2.region,
    credentials: {
      accessKeyId: CONFIG.r2.accessKeyId,
      secretAccessKey: CONFIG.r2.secretAccessKey,
    },
    forcePathStyle: true, // R2 需要
  });
}

// 上传单个文件到 R2
async function uploadToR2(s3Client, localPath, remotePath) {
  try {
    const fileContent = readFileSync(localPath);

    // 确定内容类型
    const contentType = localPath.endsWith('.webp')
      ? 'image/webp'
      : localPath.endsWith('.png')
        ? 'image/png'
        : 'image/jpeg';

    const command = new PutObjectCommand({
      Bucket: CONFIG.r2.bucketName,
      Key: remotePath,
      Body: fileContent,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1年缓存
    });

    await s3Client.send(command);
    console.log(`✅ 上传成功: ${remotePath}`);
    return true;
  } catch (error) {
    console.error(`❌ 上传失败 ${remotePath}:`, error.message);
    return false;
  }
}

// 更新博客文章中的图片路径
function updateBlogImagePath(blogFile, oldPath, newPath) {
  try {
    const content = readFileSync(blogFile, 'utf8');

    // 替换 frontmatter 中的 image 字段
    const updatedContent = content.replace(
      new RegExp(
        `^image:\\s*${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'm'
      ),
      `image: ${newPath}`
    );

    writeFileSync(blogFile, updatedContent, 'utf8');
    console.log(`📝 更新路径: ${blogFile}`);
    console.log(`   ${oldPath} → ${newPath}`);
    return true;
  } catch (error) {
    console.error(`❌ 更新失败 ${blogFile}:`, error.message);
    return false;
  }
}

// 主函数
async function main() {
  console.log('🚀 开始上传博客封面图片到 R2\n');

  try {
    // 1. 验证配置
    validateConfig();

    // 2. 获取所有博客文章
    const blogFiles = getAllBlogPosts();

    // 3. 解析封面图片
    const imageInfos = [];
    for (const blogFile of blogFiles) {
      const imageInfo = parseBlogImage(blogFile);
      if (imageInfo) {
        imageInfos.push(imageInfo);
      }
    }

    if (imageInfos.length === 0) {
      console.log('📭 没有找到需要上传的图片');
      return;
    }

    console.log(`\n🖼️  找到 ${imageInfos.length} 个需要上传的封面图片:\n`);
    imageInfos.forEach((info) => {
      console.log(`   📄 ${info.blogFile.split('/').pop()}`);
      console.log(`   🖼️  ${info.fileName}`);
    });

    // 4. 创建 S3 客户端
    const s3Client = createS3Client();

    // 5. 上传图片并更新路径
    console.log('\n📤 开始上传到 R2...\n');

    const results = {
      success: [],
      failed: [],
    };

    for (const imageInfo of imageInfos) {
      // 构建远程路径
      const remotePath = `${CONFIG.cdn.basePath}/${imageInfo.fileName}`;

      // 上传图片
      const uploadSuccess = await uploadToR2(
        s3Client,
        imageInfo.localPath,
        remotePath
      );

      if (uploadSuccess) {
        // 构建新的 CDN 路径
        const cdnPath = `${CONFIG.r2.publicUrl}/${remotePath}`;

        // 更新博客文章
        const updateSuccess = updateBlogImagePath(
          imageInfo.blogFile,
          imageInfo.frontmatterPath,
          cdnPath
        );

        if (updateSuccess) {
          results.success.push({
            blogFile: imageInfo.blogFile,
            fileName: imageInfo.fileName,
            cdnPath: cdnPath,
          });
        } else {
          results.failed.push({
            blogFile: imageInfo.blogFile,
            fileName: imageInfo.fileName,
            error: 'Failed to update blog file',
          });
        }
      } else {
        results.failed.push({
          blogFile: imageInfo.blogFile,
          fileName: imageInfo.fileName,
          error: 'Failed to upload to R2',
        });
      }
    }

    // 6. 生成报告
    console.log('\n📊 上传完成！结果统计:\n');
    console.log(`✅ 成功: ${results.success.length} 个`);
    console.log(`❌ 失败: ${results.failed.length} 个`);

    if (results.success.length > 0) {
      console.log('\n✅ 成功上传的图片:');
      results.success.forEach((result) => {
        console.log(`   🖼️  ${result.fileName}`);
        console.log(`   🔗 ${result.cdnPath}`);
      });
    }

    if (results.failed.length > 0) {
      console.log('\n❌ 失败的图片:');
      results.failed.forEach((result) => {
        console.log(`   🖼️  ${result.fileName}`);
        console.log(`   ❌ ${result.error}`);
      });
    }

    // 7. 提示验证
    if (results.success.length > 0) {
      console.log('\n🔍 建议验证 CDN 链接是否可访问');
      console.log('💡 可以运行以下命令测试:\n');
      results.success.forEach((result) => {
        console.log(`   curl -I "${result.cdnPath}"`);
      });
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

export { main as uploadBlogImagesToR2 };

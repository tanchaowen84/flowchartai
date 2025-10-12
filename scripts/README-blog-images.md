# 博客图片上传到 R2 使用说明

本工具集用于将博客封面图片批量上传到 Cloudflare R2，并自动更新博客文章中的图片路径为 CDN 地址。

## 📁 脚本文件

- `upload-blog-images-to-r2.js` - 主上传脚本
- `test-blog-cdn-images.js` - CDN链接测试脚本

## 🚀 快速开始

### 1. 环境配置

确保 `.env` 文件包含以下 R2 配置：

```env
# R2 存储配置
STORAGE_ENDPOINT=https://your-account.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_ACCESS_KEY_ID=your-r2-access-key
STORAGE_SECRET_ACCESS_KEY=your-r2-secret-key
STORAGE_BUCKET_NAME=your-bucket-name
STORAGE_PUBLIC_URL=https://cdn.yourdomain.com
```

### 2. 上传博客图片

```bash
# 上传所有博客封面图片到 R2
npm run upload-blog-images
```

### 3. 测试 CDN 链接

```bash
# 测试所有博客 CDN 图片链接是否可访问
npm run test-blog-cdn
```

## 📋 功能特性

### 🔄 上传脚本功能

- ✅ **自动扫描**: 扫描所有博客文章的封面图片
- ✅ **智能识别**: 只处理本地图片路径，跳过已有CDN链接
- ✅ **格式检测**: 自动识别图片格式并设置正确的 Content-Type
- ✅ **批量上传**: 使用 AWS SDK 上传到 Cloudflare R2
- ✅ **路径更新**: 自动更新博客文章中的图片路径为 CDN 地址
- ✅ **缓存优化**: 设置1年缓存时间
- ✅ **错误处理**: 完善的错误处理和重试机制
- ✅ **详细报告**: 生成详细的上传和更新报告

### 🔍 测试脚本功能

- ✅ **链接检测**: 检测所有博客文章中的 CDN 图片链接
- ✅ **可访问性测试**: 测试每个链接的 HTTP 状态和响应时间
- ✅ **文件信息**: 显示图片类型、大小等详细信息
- ✅ **错误诊断**: 提供详细的错误信息和修复建议

## 📁 文件结构

```
project-root/
├── content/blog/                    # 博客文章目录
│   ├── post1.mdx                   # 博客文章
│   └── post2.mdx
├── public/images/blog/              # 本地图片目录
│   ├── image1.webp                 # WebP 格式封面图片
│   └── image2.webp
├── scripts/
│   ├── upload-blog-images-to-r2.js  # 上传脚本
│   ├── test-blog-cdn-images.js      # 测试脚本
│   └── README-blog-images.md        # 说明文档
└── .env                            # 环境变量配置
```

## 🔄 工作流程

### 上传流程

1. **扫描博客文章**: 读取 `content/blog/` 目录下的所有 `.mdx` 文件
2. **解析图片信息**: 提取 frontmatter 中的 `image` 字段
3. **过滤本地图片**: 只处理本地路径（`/images/blog/` 开头）
4. **上传到 R2**: 将图片上传到 `blog/images/` 目录
5. **更新路径**: 将本地路径替换为 CDN 路径
6. **生成报告**: 显示成功和失败的详细信息

### CDN 路径格式

```
本地路径: /images/blog/flowchart-symbols.webp
CDN路径: https://cdn.yourdomain.com/blog/images/flowchart-symbols.webp
```

## 📊 使用示例

### 上传示例输出

```bash
$ npm run upload-blog-images

🚀 开始上传博客封面图片到 R2

✅ 配置验证通过
📦 R2 Bucket: flowchart-ai
🌐 CDN URL: https://cdn.flowchartai.org
📁 本地图片目录: /Users/user/project/public/images/blog

📄 找到 12 篇博客文章
🖼️  找到 10 个需要上传的封面图片:

   📄 algorithm-and-flowchart.mdx
   🖼️  algorithm-and-flowchart.webp
   📄 flowchart-symbols.mdx
   🖼️  flowchart-symbols.webp
   ...

📤 开始上传到 R2...

✅ 上传成功: blog/images/algorithm-and-flowchart.webp
📝 更新路径: /Users/user/project/content/blog/algorithm-and-flowchart.mdx
   /images/blog/algorithm-and-flowchart.webp → https://cdn.flowchartai.org/blog/images/algorithm-and-flowchart.webp

📊 上传完成！结果统计:

✅ 成功: 10 个
❌ 失败: 0 个

✅ 成功上传的图片:
   🖼️  algorithm-and-flowchart.webp
   🔗 https://cdn.flowchartai.org/blog/images/algorithm-and-flowchart.webp
   ...
```

### 测试示例输出

```bash
$ npm run test-blog-cdn

🔍 开始测试博客CDN图片链接

📄 找到 12 篇博客文章
🖼️  找到 10 个CDN图片链接:

🔗 测试: algorithm-and-flowchart.webp
   https://cdn.flowchartai.org/blog/images/algorithm-and-flowchart.webp
   ✅ 状态: 200 OK
   📄 类型: image/webp
   📏 大小: 30.14 KB

📊 测试完成！结果统计:

✅ 成功: 10 个
❌ 失败: 0 个

🎉 所有CDN图片链接都可以正常访问！
```

## ⚠️ 注意事项

### 上传前检查

1. **环境变量**: 确保所有必需的环境变量已配置
2. **图片文件**: 确保本地图片文件存在且可读
3. **权限**: 确保R2访问权限正确配置
4. **网络**: 确保可以访问R2端点

### 安全考虑

1. **敏感信息**: 不要将 `.env` 文件提交到版本控制
2. **访问密钥**: 定期轮换R2访问密钥
3. **权限最小化**: 只给予必要的读写权限

### 性能优化

1. **批量处理**: 脚本支持批量上传，提高效率
2. **错误重试**: 网络错误时自动重试
3. **缓存设置**: 设置长期缓存减少CDN请求

## 🐛 故障排除

### 常见错误

#### 1. 环境变量缺失
```bash
❌ 缺少必需的环境变量:
   - STORAGE_ACCESS_KEY_ID
   - STORAGE_SECRET_ACCESS_KEY
```
**解决方案**: 检查 `.env` 文件配置

#### 2. R2 连接失败
```bash
❌ 上传失败 blog/images/example.webp: Unable to resolve host
```
**解决方案**: 检查网络连接和R2端点配置

#### 3. 权限不足
```bash
❌ 上传失败 blog/images/example.webp: Access Denied
```
**解决方案**: 检查R2访问密钥权限

#### 4. CDN 链接 404
```bash
❌ 失败: HTTP 404
```
**解决方案**:
- 确认文件已成功上传到R2
- 检查CDN域名配置
- 验证路径格式是否正确

### 调试技巧

1. **详细日志**: 脚本提供详细的执行日志
2. **单独测试**: 可以手动测试单个文件的上传
3. **权限检查**: 使用AWS CLI测试R2访问权限

```bash
# 测试R2连接
aws s3 ls s3://your-bucket-name --endpoint-url https://your-account.r2.cloudflarestorage.com
```

## 🔄 版本历史

- **v1.0.0**: 初始版本，支持批量上传和CDN测试
- 支持 WebP、PNG、JPEG 格式
- 自动路径更新和错误处理

## 📞 支持

如果遇到问题，请检查：
1. 环境变量配置
2. R2 存储桶权限
3. 网络连接状态
4. 脚本日志输出

更多信息请参考 Cloudflare R2 和 AWS SDK 文档。
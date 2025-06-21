# FlowChart AI - Dashboard MVP 实现文档

## 📋 项目概述

### MVP 目标
为 FlowChart AI 实现最简化的作品管理系统：
1. 作品存储和加载（基于 Excalidraw 官方方案）
2. 创建新作品的入口

### 技术方案
- 使用 Excalidraw 的 `serializeAsJSON` 和 `loadFromBlob` 
- 数据库只存储作品基本信息和序列化数据

## 🗄️ 数据库设计

### 1. 作品表 (flowcharts)
```sql
CREATE TABLE flowcharts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL,              -- Excalidraw serializeAsJSON 结果
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_flowcharts_user_updated ON flowcharts(user_id, updated_at DESC);
```



## 🛠️ API 接口

### 作品管理
```typescript
// 获取作品列表
GET /api/flowcharts
Response: { flowcharts: [{ id, title, createdAt, updatedAt }] }

// 获取作品详情
GET /api/flowcharts/[id]
Response: { id, title, content, createdAt, updatedAt }

// 创建作品
POST /api/flowcharts
Body: { title?, content }
Response: { id }

// 更新作品
PUT /api/flowcharts/[id]
Body: { title?, content }

// 删除作品
DELETE /api/flowcharts/[id]
```



## 🎨 前端组件

### Dashboard 页面
```
/dashboard
├── CreateNewButton        # 创建新作品按钮
└── FlowchartList         # 作品列表
    └── FlowchartItem     # 作品项目
```

### Canvas 页面修改
- 支持 `/canvas/[id]` 路由加载现有作品
- 添加自动保存功能

## 📁 文件结构

```
src/
├── app/api/
│   └── flowcharts/
│       ├── route.ts           # 列表和创建
│       └── [id]/route.ts      # 详情、更新、删除
├── app/[locale]/(protected)/dashboard/
│   └── page.tsx               # Dashboard 页面
├── app/[locale]/canvas/
│   ├── page.tsx               # 新建作品
│   └── [id]/page.tsx          # 编辑作品
├── components/dashboard/
│   ├── create-new-button.tsx
│   ├── flowchart-list.tsx
│   └── flowchart-item.tsx
├── components/canvas/
│   └── auto-save.tsx          # 自动保存功能
├── db/schema/
│   └── flowcharts.ts
└── lib/
    └── excalidraw-storage.ts  # 存储工具函数
```

## 🚀 实施步骤

### Step 1: 数据库 (1天)
- [ ] 创建 Schema 文件
- [ ] 运行数据库迁移
- [ ] 测试数据库连接

### Step 2: API 接口 (1天)
- [ ] 实现作品 CRUD API
- [ ] 测试所有接口

### Step 3: Canvas 集成 (1天)
- [ ] 修改 Canvas 支持作品 ID
- [ ] 实现自动保存
- [ ] 实现作品加载

### Step 4: Dashboard 页面 (1天)
- [ ] 创建简单的作品列表
- [ ] 添加创建新作品按钮

## 🔧 核心代码示例

### Excalidraw 存储
```typescript
import { serializeAsJSON } from "@excalidraw/excalidraw";

// 保存
const saveFlowchart = async (excalidrawAPI, id?) => {
  const content = serializeAsJSON({
    elements: excalidrawAPI.getSceneElements(),
    appState: excalidrawAPI.getAppState(),
    files: excalidrawAPI.getFiles()
  });
  
  if (id) {
    await fetch(`/api/flowcharts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
  } else {
    const res = await fetch('/api/flowcharts', {
      method: 'POST', 
      body: JSON.stringify({ content })
    });
    return res.json().id;
  }
};

// 加载
const loadFlowchart = async (id) => {
  const res = await fetch(`/api/flowcharts/${id}`);
  const { content } = await res.json();
  return JSON.parse(content);
};
```



### 自动保存
```typescript
const useAutoSave = (excalidrawAPI, flowchartId) => {
  const debouncedSave = useMemo(
    () => debounce(async () => {
      await saveFlowchart(excalidrawAPI, flowchartId);
    }, 3000),
    [excalidrawAPI, flowchartId]
  );
  
  useEffect(() => {
    if (excalidrawAPI) {
      excalidrawAPI.onChange(debouncedSave);
    }
  }, [excalidrawAPI, debouncedSave]);
};
```

## ✅ 验收标准

- [ ] 用户可以创建新作品并自动保存
- [ ] 用户可以查看所有作品列表
- [ ] 用户可以编辑现有作品
- [ ] 用户可以删除作品

---

**这就是完整的 MVP 实现方案，简单直接，专注核心功能。**

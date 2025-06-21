# FlowChart AI - 技术实现方案

## 📋 项目概述

FlowChart AI 采用 **Mermaid → Excalidraw 转换链 + OpenRouter 工具调用** 的最短路径方案，实现AI驱动的流程图生成功能。

### 核心理念
- 利用现有成熟工具链，避免重复造轮子
- 通过 LLM 函数调用智能判断用户意图（聊天 vs 画图）
- 3行代码实现 Mermaid 到 Excalidraw 的转换
- 全程依赖公开 NPM 包与 OpenAI-compatible API

## 🏗️ 技术架构

### 数据流程图
```
用户输入 → AI聊天侧边栏 → /api/chat/flowchart
    ↓
OpenRouter LLM → 意图判断 → 函数调用决策
    ↓                        ↓
普通对话回复              generate_flowchart
    ↓                        ↓
显示文本消息              Mermaid代码生成
                             ↓
                      mermaidToExcalidraw()
                             ↓
                      Excalidraw Elements
                             ↓
                      updateScene() → 画布更新
```

### 核心依赖包
- `@excalidraw/mermaid-to-excalidraw`: 官方Mermaid转换库
- `@ai-sdk/openai` + `ai`: Vercel AI SDK
- `zod`: 函数调用参数验证

## 🎯 实现方案

### 1. API 路由设计

**文件路径**: `src/app/api/chat/flowchart/route.ts`

**核心功能**:
- 使用 Vercel AI SDK 的 `streamText`
- 配置 OpenRouter 作为 LLM 提供商
- 实现 `generate_flowchart` 工具函数
- 智能意图识别系统提示词

**函数调用配置**:
```typescript
const flowchartTool = tool({
  description: 'Generate or update a flowchart using Mermaid syntax',
  parameters: z.object({
    mermaid_code: z.string().describe('Valid Mermaid flowchart code'),
    action: z.enum(['create', 'update']).describe('Whether to create new or update existing flowchart'),
    description: z.string().describe('Brief description of the flowchart')
  }),
});
```

**系统提示词策略**:
- 明确定义触发条件：创建、生成、绘制、修改流程图
- 明确定义非触发条件：一般问答、颜色讨论、工具使用
- 提供具体示例，提高判断准确性

### 2. Mermaid 转换工具

**文件路径**: `src/lib/mermaid-converter.ts`

**核心功能**:
- 使用 `@excalidraw/mermaid-to-excalidraw` 官方转换器
- 错误处理和验证机制
- 返回标准化的转换结果

**关键API**:
```typescript
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw';

export async function convertMermaidToExcalidraw(mermaidCode: string) {
  const { elements, files } = await parseMermaidToExcalidraw(mermaidCode);
  const markedElements = elements.map(element => ({
    ...element,
    customData: { aiGenerated: true, generatedAt: Date.now() }
  }));
  return convertToExcalidrawElements(markedElements);
}

// 增量更新支持函数
export function removeAiGeneratedElements(elements: ExcalidrawElement[]) {
  return elements.filter(element => !element.customData?.aiGenerated);
}

// 撤销/重做支持
import { CaptureUpdateAction } from '@excalidraw/excalidraw';
excalidrawAPI.updateScene({
  elements: newElements,
  captureUpdate: CaptureUpdateAction.IMMEDIATELY, // 确保操作被记录到撤销历史
});
```

**增量更新机制**:
- 所有AI生成的元素都标记 `customData.aiGenerated = true`
- 生成新流程图前自动删除之前的AI生成元素
- 保留用户手动绘制的元素，实现精确替换

### 3. AI 聊天组件升级

**文件路径**: `src/components/canvas/ai-chat-sidebar.tsx`

**主要修改**:
- 集成 `useChat` Hook 替换模拟实现
- 添加 `onToolCall` 处理函数调用
- 接收 `excalidrawAPI` 参数用于画布操作
- 实现 Mermaid 转换和画布更新逻辑

**关键接口**:
```typescript
interface AiChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  excalidrawAPI?: ExcalidrawImperativeAPI; // 新增画布API引用
}
```

### 4. Excalidraw 包装器更新

**文件路径**: `src/components/canvas/excalidraw-wrapper.tsx`

**主要修改**:
- 将 `excalidrawAPI` 引用传递给 AI 聊天组件
- 确保 API 引用的正确生命周期管理

## 🔧 环境配置

### 环境变量
```bash
# OpenRouter (推荐方案)
OPENAI_API_KEY="sk-or-v1-xxx"  # OpenRouter API Key
OPENAI_BASE_URL="https://openrouter.ai/api/v1"

# 或使用 OpenAI 直连
# OPENAI_API_KEY="sk-xxx"
```

### 推荐模型
- **开发测试**: `gpt-4o-mini` (成本低，速度快)
- **生产环境**: `gpt-4o` (质量高，理解能力强)

## 🎨 用户交互流程

### 流程图生成场景
1. **用户输入**: "画一个用户注册流程图"
2. **LLM 分析**: 识别为流程图生成需求
3. **函数调用**: 触发 `generate_flowchart` 工具
4. **Mermaid 生成**:
   ```mermaid
   flowchart TD
       A[访问注册页面] --> B[填写用户信息]
       B --> C[提交表单]
       C --> D{信息验证}
       D -->|通过| E[创建账户]
       D -->|失败| F[显示错误提示]
       E --> G[发送确认邮件]
       F --> B
   ```
5. **自动转换**: Mermaid → Excalidraw 元素
6. **画布更新**: 流程图立即渲染到画布

### 普通对话场景
1. **用户输入**: "这个流程图的颜色怎么修改？"
2. **LLM 分析**: 识别为普通问答
3. **文本回复**: 直接回答用户问题
4. **画布不变**: 不触发任何画布操作

## 🚀 技术优势

### 1. 最短实现路径
- 利用官方 Mermaid 转换库，无需自定义节点系统
- 依赖成熟的 AI SDK，无需手写 API 调用
- 3-4 个文件实现完整功能

### 2. 高质量 AI 输出
- Mermaid 语法简单，LLM 支持度极高
- 标准化语法确保转换成功率
- 支持多种图表类型（流程图、时序图、甘特图等）

### 3. 成本效益优化
- OpenRouter 提供多模型选择
- 智能意图识别减少不必要的 API 调用
- 流式响应提升用户体验

### 4. 扩展性强
- 函数调用机制易于添加新工具
- Mermaid 生态系统丰富
- Excalidraw 插件系统完善

## 📦 实施计划

### 第一阶段：核心功能 (1-2天)
- [✅] 创建 `/api/ai/flowchart` API 路由
- [✅] 实现 `mermaid-converter.ts` 转换工具
- [✅] 升级 `ai-chat-sidebar.tsx` 组件
- [✅] 配置环境变量和测试

### 第二阶段：优化体验 (1天)
- [✅] 添加加载状态和错误处理
- [✅] 优化系统提示词
- [✅] 实现画布状态智能发送
- [✅] 实现增量更新功能（替换而非叠加流程图）
- [✅] 修复撤销/重做支持（使用CaptureUpdateAction.IMMEDIATELY）
- [✅] 实现扩展/替换双模式功能（智能意图检测）
- [✅] 实现画布状态分析工具（get_canvas_state）

### 第三阶段：高级功能 (可选)
- [ ] 支持画布截图发送给 AI
- [ ] 实现模板库集成
- [ ] 添加协作功能
- [ ] 支持更多 Mermaid 图表类型

## 🐛 潜在问题与解决方案

### 1. Mermaid 语法错误
**问题**: AI 生成的 Mermaid 代码可能存在语法错误
**解决**: 
- 在系统提示词中强调语法正确性
- 添加 Mermaid 语法验证中间件
- 提供错误反馈和重试机制

### 2. 画布性能问题
**问题**: 大型流程图可能影响 Excalidraw 性能
**解决**:
- 限制单次生成的节点数量
- 实现增量更新而非完全替换
- 添加画布缩放和定位优化

### 3. API 调用成本
**问题**: 频繁的 AI 调用可能产生较高成本
**解决**:
- 实现请求防抖机制
- 缓存常用流程图模板
- 使用成本更低的模型进行意图识别

## 🔍 测试用例

### 功能测试
```typescript
// 应该触发流程图生成
const shouldGenerate = [
  "画一个登录流程",
  "创建用户注册流程图",
  "生成支付处理流程",
  "设计审批流程图",
  "更新这个流程图，添加错误处理"
];

// 应该进行普通对话
const shouldChat = [
  "什么是流程图？",
  "如何使用这个工具？",
  "颜色看起来不错",
  "可以解释一下这个步骤吗？",
  "这个工具支持哪些功能？"
];
```

### 性能测试
- Mermaid 转换耗时 < 100ms
- API 响应时间 < 2s
- 画布更新延迟 < 50ms

## 📚 参考文档

- [Excalidraw Mermaid Integration](https://github.com/excalidraw/mermaid-to-excalidraw)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [OpenRouter API Reference](https://openrouter.ai/docs)
- [Mermaid Syntax Guide](https://mermaid.js.org/syntax/flowchart.html)

## 🤝 贡献指南

1. 遵循现有代码风格和 TypeScript 严格模式
2. 所有新功能需要添加相应测试用例
3. API 变更需要更新相关文档
4. 提交前运行 `pnpm lint` 和 `pnpm build`

## 🔄 撤销/重做功能修复

### 问题描述
用户反馈AI生成流程图后无法使用Excalidraw内置的撤销功能，每次AI更新都会重置撤销历史。

### 根本原因
使用 `excalidrawAPI.updateScene()` 时没有设置 `captureUpdate` 参数，导致操作未被记录到撤销历史中。

### 解决方案
```typescript
import { CaptureUpdateAction } from '@excalidraw/excalidraw';

excalidrawAPI.updateScene({
  elements: newElements,
  captureUpdate: CaptureUpdateAction.IMMEDIATELY, // 关键修复
});
```

## 🔍 画布状态分析功能

### 问题背景
之前的实现只能保存AI生成时的原始Mermaid代码，无法感知：
- 用户对AI生成元素的手动修改（移动、调整大小、改颜色等）
- 用户手动添加的新元素
- 当前画布的真实状态

### 解决方案：Canvas Analyzer

**文件路径**: `src/lib/canvas-analyzer.ts`

**核心功能**:
```typescript
// 分析画布所有元素并生成详细描述
export function analyzeCanvasElements(elements: ExcalidrawElement[]): CanvasAnalysis;

// 为AI生成简化的画布状态描述
export function generateAICanvasDescription(elements: ExcalidrawElement[]): string;
```

**分析内容**:
- **元素统计**: 按类型分组统计（矩形、椭圆、箭头等）
- **空间布局**: 边界框、元素分组、位置关系
- **连接关系**: 分析箭头连接的起始和结束元素
- **文本内容**: 提取所有文本元素和标签内容
- **元素来源**: 区分AI生成元素 vs 用户添加元素
- **用户修改**: 检测对AI元素的手动修改

### AI工具集成

**新增工具**: `get_canvas_state`
```typescript
const canvasAnalysisTool = {
  type: 'function',
  function: {
    name: 'get_canvas_state',
    description: 'Get detailed analysis of current canvas elements, including user modifications',
    parameters: { type: 'object', properties: {}, required: [] }
  }
};
```

**使用场景**:
- AI需要了解当前画布状态时主动调用
- 修改现有流程图前先分析当前内容
- 智能感知用户的手动修改

**示例输出**:
```
The canvas contains 8 elements in total. Element types: 3 rectangles, 2 arrows, 2 text, 1 ellipse. 5 elements were AI-generated. 3 elements were manually added by the user. Text content includes: "开始", "处理数据", "结束". There are 2 connections between elements. The content spans approximately 450 x 300 pixels.
```

### 技术实现

**元素分析算法**:
- **空间分组**: 基于距离的聚类算法识别相关元素
- **连接分析**: 通过startBinding和endBinding识别箭头连接
- **文本提取**: 统一处理text元素和label属性
- **来源识别**: 通过customData.aiGenerated标记区分元素来源

**性能优化**:
- 只分析非删除元素
- 高效的距离计算和分组算法
- 简洁的自然语言描述生成

### 技术细节
- `CaptureUpdateAction.IMMEDIATELY`: 立即将操作记录到撤销历史
- `CaptureUpdateAction.EVENTUALLY`: 延迟记录，适用于多步骤操作
- `CaptureUpdateAction.NEVER`: 永不记录，适用于远程更新或初始化

### 用户体验改进
- ✅ AI生成流程图 → 可撤销
- ✅ AI修改流程图 → 可撤销到之前版本
- ✅ 手动编辑元素 → 可撤销
- ✅ 所有操作在同一个线性撤销历史中
- ✅ 利用Excalidraw原生撤销功能，无需自定义版本管理

## 🔀 扩展/替换模式功能

### 功能概述
实现AI流程图的两种更新模式：
- **替换模式 (Replace)**: 完全替换现有AI生成的流程图
- **扩展模式 (Extend)**: 在现有流程图基础上进行扩展和修改

### 实现原理

**元素标记系统**：
```typescript
// 保存原始Mermaid代码和会话ID
const markedElements = excalidrawElements.map((element) => ({
  ...element,
  customData: {
    aiGenerated: true,
    generatedAt: Date.now(),
    originalMermaid: mermaidSyntax, // 保存原始代码
    sessionId: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  },
}));
```

**智能意图检测**：
```typescript
// AI根据用户输入自动判断模式
const flowchartTool = {
  function: {
    parameters: {
      mode: {
        type: 'string',
        enum: ['replace', 'extend'],
        description: 'Whether to replace existing flowchart completely or extend/modify it'
      }
    }
  }
};
```

**上下文传递**：
```typescript
// 将现有Mermaid代码作为上下文发送给AI
const canvasState = {
  existingMermaid: extractExistingMermaidCode(elements),
  hasAiFlowchart: hasExistingAiFlowchart(elements),
};
```

### 模式判断逻辑

**替换模式触发词**：
- "重新画"、"替换"、"删除原来的"
- "Draw a new flowchart"、"Create a fresh diagram"
- "Start over with"、"Replace this with"

**扩展模式触发词**：
- "添加"、"增加"、"在此基础上"、"扩展"
- "Add to this flowchart"、"Modify the diagram"
- "Update the flowchart with"、"Improve this by adding"

### 技术实现

**工具函数**：
```typescript
// 提取现有Mermaid代码
export function extractExistingMermaidCode(elements: ExcalidrawElement[]): string | null

// 检查是否有AI生成的流程图
export function hasExistingAiFlowchart(elements: ExcalidrawElement[]): boolean

// 双模式画布更新
const addFlowchartToCanvas = async (mermaidCode: string, mode: 'replace' | 'extend' = 'replace')
```

**处理逻辑**：
```typescript
if (mode === 'replace') {
  // 删除现有AI元素，添加新元素
  const elementsWithoutAi = removeAiGeneratedElements(currentElements);
  newElements = [...elementsWithoutAi, ...result.elements];
} else {
  // 保留所有元素，添加新元素
  newElements = [...currentElements, ...result.elements];
}
```

### 用户体验优化

**智能提示消息**：
- 替换模式: "Flowchart updated!" / "Flowchart added!"
- 扩展模式: "Flowchart extended!"

**可视化反馈**：
- 扩展模式: "🎨 **Extending flowchart...**"
- 替换模式: "🎨 **Generating flowchart...**"

**撤销支持**：
- 两种模式都支持Excalidraw原生撤销功能
- 用户可以轻松回退到任何历史状态

### 应用场景

**替换模式适用于**：
- 完全重新设计流程图
- 改变流程图类型或结构
- 从头开始创建新图表

**扩展模式适用于**：
- 在现有流程中添加新步骤
- 增加错误处理分支
- 优化或补充现有流程

---

**最后更新**: 2024-12-19
**文档版本**: v1.1
**负责人**: 开发团队 
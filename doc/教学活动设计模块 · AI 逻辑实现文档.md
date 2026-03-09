# 教学活动设计模块 · AI 逻辑实现文档

> 本文档描述从教师在前端填写课程信息，到系统逐步调用 AI 模型、生成教学框架、构建教学流程、设计学生活动的完整数据流与提示词逻辑。文档以现有项目的数据结构（`store.ts`）和接口约定（`routers.ts`）为基础，补充尚未实现的 AI 调用层设计，使整套系统可以端到端落地。

---

## 一、整体架构与数据流向

整个系统采用**五步线性流程**，每一步的输出作为下一步的输入上下文，形成递进的信息积累链路。AI 介入的时机分为两类：**主动生成**（系统在关键节点自动调用模型，生成结构化内容填入表单）和**对话辅助**（教师主动打开 AI 面板，针对某个字段发起自然语言对话）。

```
Step 1 课程上下文
  ↓ Context 对象（topic / coreQuestion / concepts / ability / competency / duration / courseType / studentGrade）
Step 2 教学框架选择
  ↓ Model 对象（modelId / stages[] / logicRelationSet[]）
Step 3 教学流程编辑
  ↓ PathInstance 对象（stages[] → nodes[]，每个 node 含 learningGoal / nodeType / logicRelation / estimatedTime）
Step 4 活动设计
  ↓ Activity 对象（activityType / taskDescription / toolRequired / deliverableType / evaluationMode / evaluationRubric）
Step 5 预览发布
  ↓ 完整教案 JSON（可导出 / 存库）
```

每一步都有独立的 tRPC 后端 procedure 负责 AI 调用，前端通过 `trpc.*.useMutation()` 触发，结果写入 Zustand store，UI 响应式更新。

---

## 二、Step 1 — 课程上下文提取

### 2.1 触发时机

教师上传 PDF / Word / TXT 格式的教案或课件后，前端将文件内容通过 `trpc.ai.extractContext` 发送至后端，后端调用模型提取结构化信息，以逐条气泡的形式返回供教师逐一确认或拒绝。

### 2.2 后端 Procedure 设计

```typescript
// server/routers/aiRouter.ts
extractContext: publicProcedure
  .input(z.object({ fileText: z.string().max(20000) }))
  .mutation(async ({ input }) => {
    const result = await generateObject({
      model: openai.chat("gemini-2.5-flash"),
      schema: z.object({
        topic:        z.string().describe("教学主题，简洁的名词短语"),
        coreQuestion: z.string().describe("核心问题，以疑问句结尾"),
        concepts:     z.array(z.string()).max(6).describe("3-6个关键概念"),
        ability:      z.string().describe("目标能力，以动词开头的可测量陈述"),
        competency:   z.string().describe("核心素养，如批判性思维、科学探究等"),
        duration:     z.number().nullable().describe("课时时长（分钟），只能是35/40/60/90/120之一"),
        courseType:   z.enum(["概念建构", "自主探究"]).nullable(),
        studentGrade: z.string().nullable().describe("适合学段"),
      }),
      prompt: EXTRACT_CONTEXT_PROMPT(input.fileText),
    });
    return result.object;
  }),
```

### 2.3 提示词设计

```
EXTRACT_CONTEXT_PROMPT(fileText: string):

你是一位专业的教学设计顾问，擅长从教案文本中提炼结构化的课程信息。

请仔细阅读以下教案或课件文本，提取关键信息并严格按照 JSON Schema 输出。

【提取规则】
1. topic（教学主题）：提取最核心的知识点名称，不超过 15 字，不含"教学"、"课程"等冗余词
2. coreQuestion（核心问题）：找出或推断出本课最值得探究的问题，必须以"？"结尾，体现高阶思维
3. concepts（关键概念）：提取 3-6 个本课必须掌握的核心概念词，每个不超过 8 字
4. ability（目标能力）：用"能够……"句式描述学生学完后应具备的具体能力，包含可观察的行为动词
5. competency（核心素养）：对应课程标准中的素养维度，如"科学思维"、"批判性思维"、"信息素养"等
6. duration（课时）：若文本中有明确时间则提取，否则输出 null
7. courseType：若课程以概念理解为主输出"概念建构"，以问题解决/实验为主输出"自主探究"
8. studentGrade：提取适合学段，若无明确信息则输出 null

【教案文本】
${fileText}

请输出符合 Schema 的 JSON，不要输出任何解释文字。
```

### 2.4 前端确认机制

模型返回的每个字段以独立气泡展示，教师可以**采纳**（直接写入 store）或**拒绝**（保留空值，手动填写）。全部处理完毕后，三个信息块（知识核心、能力目标、课堂条件）自动顺序展开，教师可继续手动补充或修改。

**Context 对象最终结构（写入 store 的数据）：**

| 字段 | 类型 | 来源 |
|------|------|------|
| `topic` | `string` | AI 提取 / 手动填写 |
| `coreQuestion` | `string` | AI 提取 / 手动填写 |
| `concepts` | `string[]` | AI 提取 / 手动添加 |
| `ability` | `string` | AI 提取 / 手动填写 |
| `competency` | `string` | AI 提取 / 手动填写 |
| `duration` | `35\|40\|60\|90\|120\|null` | AI 提取 / 单选 |
| `courseType` | `'概念建构'\|'自主探究'\|null` | AI 提取 / 单选 |
| `studentGrade` | `StudentGrade\|null` | AI 提取 / 单选 |

---

## 三、Step 2 — 教学框架推荐

### 3.1 触发时机

教师进入 Step 2 时，系统根据 Step 1 确认的 `Context`（特别是 `courseType`、`topic`、`coreQuestion`）自动高亮推荐最匹配的教学框架。推荐逻辑分为两层：**规则层**（基于 `courseType` 快速过滤）和 **AI 排序层**（调用模型给出排序理由）。

### 3.2 推荐逻辑

**规则层（前端直接执行，无需 API）：**

```typescript
// 根据 courseType 过滤推荐模型
const recommendedModels = PRESET_MODELS.filter(m =>
  !m.recommendedFor || m.recommendedFor.includes(context.courseType!)
);
```

**AI 排序层（可选，调用后端）：**

```typescript
// server/routers/aiRouter.ts
recommendModel: publicProcedure
  .input(z.object({
    topic: z.string(),
    coreQuestion: z.string(),
    courseType: z.enum(["概念建构", "自主探究"]),
    studentGrade: z.string().nullable(),
    availableModels: z.array(z.object({
      modelId: z.string(),
      modelName: z.string(),
      description: z.string(),
    })),
  }))
  .mutation(async ({ input }) => {
    const result = await generateObject({
      model: openai.chat("gemini-2.5-flash"),
      schema: z.object({
        rankedModelIds: z.array(z.string()).describe("按推荐度从高到低排列的 modelId 列表"),
        reason: z.string().describe("推荐第一个框架的简短理由，不超过 50 字"),
      }),
      prompt: RECOMMEND_MODEL_PROMPT(input),
    });
    return result.object;
  }),
```

### 3.3 提示词设计

```
RECOMMEND_MODEL_PROMPT(input):

你是一位教学设计专家，请根据以下课程信息，从给定的教学框架列表中选出最适合的框架，并按推荐度排序。

【课程信息】
- 教学主题：${input.topic}
- 核心问题：${input.coreQuestion}
- 课程类型：${input.courseType}
- 适合学段：${input.studentGrade ?? "未指定"}

【可选教学框架】
${input.availableModels.map((m, i) => `${i+1}. ${m.modelName}：${m.description}`).join("\n")}

【判断依据】
- 概念建构类课程优先选择强调"认知修订"或"多轮迭代"的框架
- 自主探究类课程优先选择强调"问题驱动"或"实验验证"的框架
- 核心问题若包含"为什么"，说明需要因果推断，优先选择支持"推翻"逻辑关系的框架
- 核心问题若包含"如何"，说明需要方法论，优先选择支持"分解"和"验证"的框架

请输出 rankedModelIds 数组（仅包含 modelId）和推荐理由。
```

### 3.4 Model 对象结构

教师选定框架后，`selectedModel` 写入 store，其核心字段如下：

| 字段 | 说明 | 用途 |
|------|------|------|
| `modelId` | 框架唯一标识 | 关联 PathInstance |
| `stages[]` | 阶段名称列表（如"明确认知对象"、"提出个体断言"） | Step 3 生成阶段骨架 |
| `logicRelationSet[]` | 允许的逻辑关系类型 | Step 3 约束 node 间关系 |
| `suggestedNodeRange` | 建议环节数量范围（如"5-7"） | Step 3 生成提示 |
| `suggestedRhythm` | 节奏建议（前慢后快 / 均匀分布 / 中间密集） | Step 3 时间分配参考 |

---

## 四、Step 3 — 教学流程生成

这是整个系统**最核心的 AI 生成环节**。系统需要根据 Context + Model 生成完整的 `PathInstance`，包含多个 `StageInstance`，每个阶段下包含若干 `Node`（教学环节）。

### 4.1 触发时机

教师在 Step 2 确认框架后点击"下一步"，系统自动触发 `trpc.ai.generatePath` 调用，生成初始教学流程骨架。教师可在 Step 3 页面对每个环节进行手动调整，也可以通过 AI 面板针对单个 node 发起对话优化。

### 4.2 后端 Procedure 设计

```typescript
// server/routers/aiRouter.ts
generatePath: publicProcedure
  .input(z.object({
    context: ContextSchema,    // 完整的 Context 对象
    model: ModelSchema,        // 选定的 Model 对象
  }))
  .mutation(async ({ input }) => {
    const result = await generateObject({
      model: openai.chat("gemini-2.5-flash"),
      schema: PathInstanceSchema,   // 见下方 Schema 定义
      prompt: GENERATE_PATH_PROMPT(input.context, input.model),
    });
    return result.object;
  }),
```

**PathInstance Schema（用于结构化输出约束）：**

```typescript
const NodeSchema = z.object({
  nodeType:               z.enum(NODE_TYPES),
  learningGoal:           z.string().describe("以'能够'开头的可测量学习目标，不超过30字"),
  studentBehavior:        z.string().describe("学生在该环节的主要行为，动词短语"),
  evidenceType:           z.string().describe("可观察的学习证据类型，如'时间线图'、'讨论记录'"),
  teacherSupportBehavior: z.string().describe("教师支持行为，说明如何引导而非讲授"),
  estimatedTime:          z.number().int().min(3).max(30).describe("预计时间（分钟）"),
  logicRelation:          z.enum(ALLOWED_LOGIC_RELATIONS),
});

const StageInstanceSchema = z.object({
  stageType: z.string().describe("阶段名称，与所选框架的 stages[] 对应"),
  nodes:     z.array(NodeSchema).min(1).max(4),
});

const PathInstanceSchema = z.object({
  stages: z.array(StageInstanceSchema),
});
```

### 4.3 提示词设计

```
GENERATE_PATH_PROMPT(context, model):

你是一位资深教学设计师，请根据以下课程信息和教学框架，生成一套完整的教学流程。

【课程信息】
- 教学主题：${context.topic}
- 核心问题：${context.coreQuestion}
- 关键概念：${context.concepts.join("、")}
- 目标能力：${context.ability}
- 核心素养：${context.competency}
- 课时长度：${context.duration} 分钟
- 课程类型：${context.courseType}
- 适合学段：${context.studentGrade}

【选用教学框架】
框架名称：${model.modelName}
阶段序列：${model.stages.join(" → ")}
节奏建议：${model.suggestedRhythm}（${model.suggestedNodeRange} 个教学环节）
允许的逻辑关系：${model.logicRelationSet.join("、")}
框架说明：${model.description}

【生成规则】
1. 严格按照框架的阶段序列生成，每个阶段至少 1 个教学环节（node）
2. 所有环节的 estimatedTime 之和必须等于课时长度（${context.duration} 分钟），允许误差 ±3 分钟
3. 节奏建议"前慢后快"意味着前半段环节时间较长（深度理解），后半段较短（快速应用）
4. 节奏建议"中间密集"意味着中间阶段环节数量最多，首尾较少
5. 每个 node 的 logicRelation 必须从允许列表中选取，且相邻 node 的关系应体现认知进阶
6. learningGoal 必须与 context.ability 在认知层次上保持一致（不能比目标能力更高或更低）
7. teacherSupportBehavior 描述教师如何"引导"而非"讲授"，体现以学生为中心
8. evidenceType 必须是具体可收集的产出物，如"时间线图"、"断言卡片"、"对比表格"，不能是抽象描述

【环节类型参考】
概念理解 / 比较分析 / 实验探究 / 因果推断 / 综合讨论 / 抽象总结 / 迁移应用 / 问题建构 / 变量控制 / 解释推理 / 实验操作

请直接输出符合 Schema 的 JSON，不要输出任何解释文字。
```

### 4.4 流程生成后的数据结构

生成完成后，`PathInstance` 写入 store，结构如下（以认知修订模型 + 40分钟课为例）：

```
PathInstance {
  modelId: "cognitive-revision",
  duration: 40,
  status: "草稿",
  stages: [
    StageInstance {
      stageType: "明确认知对象",
      nodes: [
        Node {
          nodeType: "概念理解",
          learningGoal: "能够识别三次浪潮的时间节点与核心技术特征",
          studentBehavior: "阅读材料并在时间轴上标注",
          evidenceType: "时间线图",
          teacherSupportBehavior: "提供结构化阅读材料，引导关注关键时间节点",
          estimatedTime: 8,
          logicRelation: "建立",
          activities: []
        }
      ]
    },
    StageInstance {
      stageType: "提出个体断言",
      nodes: [
        Node {
          nodeType: "因果推断",
          learningGoal: "能够提出关于第一次低谷原因的个人断言",
          studentBehavior: "独立写下断言并说明理由",
          evidenceType: "断言卡片",
          teacherSupportBehavior: "提供断言框架模板，不提前给出答案",
          estimatedTime: 8,
          logicRelation: "建立",
          activities: []
        }
      ]
    },
    // ... 更多阶段
  ]
}
```

### 4.5 AI 面板对话辅助（单 Node 优化）

教师在 Step 3 点击某个环节旁的 AI 按钮，打开 AI 面板并绑定该 `nodeId`。此时面板进入 `path-node` 上下文，后端 procedure 接收到 `nodeId` 后从 store 中读取该 node 的完整信息，结合 Context 和 Model 生成优化建议。

```typescript
// server/routers/aiRouter.ts
optimizeNode: protectedProcedure
  .input(z.object({
    node: NodeSchema,
    context: ContextSchema,
    model: ModelSchema,
    userRequest: z.string(),
  }))
  .mutation(async ({ input }) => {
    const stream = streamText({
      model: openai.chat("gemini-2.5-flash"),
      prompt: OPTIMIZE_NODE_PROMPT(input),
    });
    return stream.toTextStreamResponse();
  }),
```

**提示词设计：**

```
OPTIMIZE_NODE_PROMPT(input):

你是教学设计助手，正在帮助教师优化一个教学环节。

【当前课程背景】
主题：${input.context.topic} | 核心问题：${input.context.coreQuestion}
课时：${input.context.duration}分钟 | 框架：${input.model.modelName}

【当前教学环节】
类型：${input.node.nodeType}
学习目标：${input.node.learningGoal}
学生行为：${input.node.studentBehavior}
证据类型：${input.node.evidenceType}
教师支持：${input.node.teacherSupportBehavior}
预计时间：${input.node.estimatedTime}分钟
逻辑关系：${input.node.logicRelation}

【教师请求】
${input.userRequest}

请直接回应教师的请求。如果需要修改字段，在回复末尾用 JSON 块标注修改内容：
\`\`\`json
{ "field": "learningGoal", "value": "新的学习目标" }
\`\`\`
前端将自动解析并应用这些变更。
```

---

## 五、Step 4 — 活动设计生成

### 5.1 触发时机

教师进入 Step 4 后，每个 Node 默认显示"让 AI 帮我设计活动"入口。点击后触发 `trpc.ai.generateActivities`，为该 node 生成 1-2 个具体的学生活动。教师也可以从活动模板库中一键套用预设结构，再由 AI 补充具体内容。

### 5.2 后端 Procedure 设计

```typescript
// server/routers/aiRouter.ts
generateActivities: publicProcedure
  .input(z.object({
    node: NodeSchema,
    context: ContextSchema,
    count: z.number().int().min(1).max(3).default(1),
  }))
  .mutation(async ({ input }) => {
    const result = await generateObject({
      model: openai.chat("gemini-2.5-flash"),
      schema: z.object({
        activities: z.array(ActivitySchema).min(1).max(3),
      }),
      prompt: GENERATE_ACTIVITIES_PROMPT(input),
    });
    return result.object;
  }),
```

**Activity Schema：**

```typescript
const ActivitySchema = z.object({
  activityType:    z.enum(ACTIVITY_TYPES).describe("活动类型"),
  taskDescription: z.string().describe("具体任务描述，包含时间约束、形式说明和产出要求，不超过100字"),
  toolRequired:    z.string().describe("所需工具或材料，若无则填'无'"),
  deliverableType: z.enum(["文本", "图片", "表格", "口头表达", "实物", "数据"]),
  evaluationMode:  z.enum(["人工评价", "同伴互评", "自评", "AI辅助评价"]),
  evaluationRubric:z.string().describe("评价量规，2-3条标准，每条不超过20字"),
  estimatedTime:   z.number().int().min(3).max(25),
});
```

### 5.3 提示词设计

```
GENERATE_ACTIVITIES_PROMPT(input):

你是一位擅长设计学生活动的教学设计师。请根据以下教学环节信息，设计 ${input.count} 个具体的学生活动。

【课程背景】
主题：${input.context.topic}
核心问题：${input.context.coreQuestion}
目标能力：${input.context.ability}
学段：${input.context.studentGrade}

【当前教学环节】
环节类型：${input.node.nodeType}
学习目标：${input.node.learningGoal}
学生行为：${input.node.studentBehavior}
证据类型：${input.node.evidenceType}（活动产出必须能生成这类证据）
预计时间：${input.node.estimatedTime}分钟（活动时间之和不超过此值）
逻辑关系：${input.node.logicRelation}（活动设计应体现此认知操作）

【活动设计原则】
1. taskDescription 必须包含三要素：时间约束（"在X分钟内"）、协作形式（个人/小组/全班）、产出要求（交什么）
2. 活动类型与环节类型的对应关系：
   - 概念理解 → 阅读理解、单项填空
   - 比较分析 → 讨论表达、图表制作
   - 因果推断 → 讨论表达、书面论证
   - 综合讨论 → 讨论表达、角色扮演
   - 抽象总结 → 单项填空、概念图绘制
   - 迁移应用 → 案例分析、问题解决
3. evaluationRubric 聚焦认知质量，避免形式性标准（如"字迹工整"）
4. 逻辑关系"建立"对应初次接触概念的活动；"对比"对应比较分析；"推翻"对应质疑与反驳；"应用"对应迁移练习

请直接输出符合 Schema 的 JSON。
```

### 5.4 活动类型与环节类型对应矩阵

| 环节类型 | 推荐活动类型 | 典型产出物 | 评价方式 |
|---------|------------|----------|---------|
| 概念理解 | 阅读理解、单项填空 | 时间线图、填空答案 | 人工评价 |
| 比较分析 | 讨论表达、图表制作 | 对比表格、维恩图 | 人工评价 / 同伴互评 |
| 因果推断 | 书面论证、讨论表达 | 断言卡片、论证段落 | 人工评价 |
| 综合讨论 | 讨论表达、角色扮演 | 讨论记录、观点陈述 | 同伴互评 |
| 抽象总结 | 单项填空、概念图 | 总结句、概念图 | 人工评价 |
| 迁移应用 | 案例分析、问题解决 | 分析报告、解决方案 | 人工评价 / AI辅助 |
| 实验探究 | 实验操作、数据记录 | 实验记录表、数据图 | 人工评价 |
| 问题建构 | 讨论表达、头脑风暴 | 问题清单 | 同伴互评 |

---

## 六、AI 面板对话辅助的通用机制

AI 面板在任意步骤均可打开，绑定到当前编辑的上下文区域（`AiContext` 类型）。对话历史按上下文分区独立保存，关闭面板不丢失。

### 6.1 上下文类型与对应字段

| AiContext | 绑定字段 | 典型用户请求 | 模型输出格式 |
|-----------|---------|------------|------------|
| `context-block1` | topic / coreQuestion / concepts | "帮我优化核心问题" | 流式文本 + JSON 变更块 |
| `context-block2` | ability / competency | "把目标改得更具体" | 流式文本 + JSON 变更块 |
| `context-block3` | duration / courseType / studentGrade | "这个主题适合哪种课程类型" | 流式文本（无变更） |
| `path-node` | Node（通过 nodeId 定位） | "优化这个环节的学习目标" | 流式文本 + JSON 变更块 |
| `activity` | Activity（通过 nodeId 定位） | "帮我设计一个具体活动" | 流式文本 + JSON 变更块 |

### 6.2 变更应用协议

模型在流式回复末尾输出 JSON 变更块，前端解析后自动调用 store 的对应 action：

```typescript
// 前端解析逻辑（伪代码）
const jsonMatch = reply.match(/```json\n([\s\S]+?)\n```/);
if (jsonMatch) {
  const { field, value } = JSON.parse(jsonMatch[1]);
  // 根据 activeContext 路由到对应的 store action
  if (activeContext === 'context-block1') updateContext({ [field]: value });
  if (activeContext === 'path-node') updateNode(activeNodeId, { [field]: value });
  if (activeContext === 'activity') updateActivity(activeActivityId, { [field]: value });
}
```

### 6.3 系统提示词（全局）

所有 AI 面板对话共享同一个系统提示词，注入当前完整的课程上下文：

```
你是一位专业的教学设计助手，正在协助教师完成一节课的教学设计。

【当前课程信息】
主题：${context.topic || "（未填写）"}
核心问题：${context.coreQuestion || "（未填写）"}
目标能力：${context.ability || "（未填写）"}
课时：${context.duration ? context.duration + "分钟" : "（未设置）"}
框架：${selectedModel?.modelName || "（未选择）"}

【你的工作原则】
1. 回复简洁，不超过 150 字，直接给出建议或修改结果
2. 如果需要修改某个字段，在回复末尾附上 JSON 变更块
3. 不要重复用户的问题，直接给出答案
4. 如果用户的请求不明确，给出 2-3 个具体选项让用户选择，不要反问
5. 保持教学专业性，建议应符合课程标准和教学规律
```

---

## 七、Step 5 — 预览与导出

Step 5 不涉及主动 AI 调用，但提供两个辅助功能：

**教案摘要生成**（可选）：调用 `trpc.ai.summarizePlan`，将完整的 `PathInstance` 转换为一段自然语言教案摘要，供教师快速预览整体设计思路。

```typescript
summarizePlan: publicProcedure
  .input(z.object({ pathInstance: PathInstanceSchema, context: ContextSchema }))
  .mutation(async ({ input }) => {
    const stream = streamText({
      model: openai.chat("gemini-2.5-flash"),
      prompt: `请用 200 字以内的自然语言描述以下教学设计方案的整体思路，
              重点说明：教学逻辑如何展开、学生认知如何递进、核心问题如何被回答。
              
              课程信息：${JSON.stringify(input.context)}
              教学流程：${JSON.stringify(input.pathInstance)}`,
    });
    return stream.toTextStreamResponse();
  }),
```

**导出格式**：完整的 `PathInstance` + `Context` + `selectedModel` 合并为标准 JSON，可存入数据库或导出为 Word 格式（通过后端模板渲染）。

---

## 八、模型选型与调用参数

| 调用场景 | 推荐模型 | 调用方式 | 温度参数 | 说明 |
|---------|---------|---------|---------|------|
| 文件内容提取（Step 1） | `gemini-2.5-flash` | `generateObject` | 0.2 | 结构化输出，需要稳定性 |
| 框架推荐排序（Step 2） | `gemini-2.5-flash` | `generateObject` | 0.3 | 半结构化，允许少量创造性 |
| 教学流程生成（Step 3） | `gemini-2.5-flash` | `generateObject` | 0.5 | 需要创造性但受 Schema 约束 |
| 活动设计生成（Step 4） | `gemini-2.5-flash` | `generateObject` | 0.6 | 活动描述需要多样性 |
| AI 面板对话辅助 | `gemini-2.5-flash` | `streamText` | 0.7 | 对话需要自然流畅 |
| 教案摘要生成（Step 5） | `gemini-2.5-flash` | `streamText` | 0.4 | 摘要需要准确性 |

所有调用均通过 Manus 内置的 Forge API 代理，使用 `BUILT_IN_FORGE_API_KEY` 和 `BUILT_IN_FORGE_API_URL` 环境变量，无需额外配置密钥。

---

## 九、错误处理与降级策略

| 错误类型 | 处理方式 |
|---------|---------|
| 模型调用超时（>15s） | 前端显示"AI 生成超时，请重试"，保留已有内容 |
| Schema 验证失败 | 后端重试一次（temperature 降低 0.1），失败则返回空结构，前端提示手动填写 |
| 文件解析失败（Step 1） | 跳过 AI 提取，直接展开手动填写表单 |
| 时间分配超出课时 | 后端在 Schema 层约束总时间，若仍超出则按比例缩放各环节时间 |
| 对话上下文过长 | 超过 8 轮对话时，自动压缩历史消息（保留首轮系统提示 + 最近 4 轮） |

---

## 十、实现优先级建议

按照对用户价值的影响程度，建议按以下顺序实现各 AI 功能：

**第一优先级（核心路径，必须实现）：**

Step 3 教学流程生成（`generatePath`）是整个产品的核心价值所在，直接决定用户是否愿意持续使用。应优先完成此 procedure 的实现和提示词调优。

**第二优先级（显著提升体验）：**

Step 1 文件提取（`extractContext`）和 Step 4 活动设计（`generateActivities`）能大幅降低填写门槛，是用户留存的关键。

**第三优先级（锦上添花）：**

Step 2 框架推荐排序（`recommendModel`）、AI 面板对话辅助（`optimizeNode`）和 Step 5 教案摘要（`summarizePlan`）可在核心功能稳定后逐步加入。

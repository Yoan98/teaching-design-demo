export type PromptKey =
  | 'extractContext'
  | 'recommendModel'
  | 'generatePath'
  | 'optimizeNode'
  | 'generateActivities'
  | 'summarizePlan'
  | 'aiPanelGlobalSystem';

export type PromptPart = 'system' | 'user';

export interface PromptTemplate {
  system: string;
  user: string;
}

export interface PromptImpact {
  purpose: string;
  trigger: string;
  changeImpact: string[];
  affects: string[];
}

export const DEFAULT_PROMPTS: Record<PromptKey, PromptTemplate> = {
  extractContext: {
    system: '你是一位专业的教学设计顾问，擅长将教案内容提取为结构化 JSON。必须严格遵守用户给定字段并只返回 JSON。',
    user: `请从以下教案文本中提取结构化课程信息，并严格返回 JSON。\n\n【教案文本】\n{{fileText}}\n\n【返回 JSON 字段】\n- topic: string\n- coreQuestion: string\n- concepts: string[]\n- ability: string\n- competency: string\n- duration: 35|40|60|90|120|null\n- courseType: 概念建构|自主探究|null\n- studentGrade: string|null\n- studentLevel: 基础|中等|进阶|null\n\n仅输出 JSON，不要解释。`,
  },

  recommendModel: {
    system: '你是教学框架推荐专家。你会根据课程上下文在候选模型中排序，并给出一句可解释理由。输出必须是 JSON。',
    user: `根据课程信息与可选模型列表，输出推荐排序 JSON。\n\n课程信息：\n{{contextJson}}\n\n可选模型：\n{{modelsJson}}\n\n返回 JSON：\n- rankedModelIds: string[]\n- reason: string（不超过50字）`,
  },

  generatePath: {
    system: '你是资深教学设计师，负责生成结构化课堂路径。输出必须为 JSON，且阶段顺序必须严格遵循模型定义。',
    user: `请根据课程上下文与选定模型生成 PathInstance。\n\n课程上下文：\n{{contextJson}}\n\n模型定义：\n{{modelJson}}\n\n约束：\n1. stages 顺序必须与模型一致\n2. 每个 stage 至少1个 node\n3. 所有 node 的 estimatedTime 总和尽量接近课程时长（误差±3）\n4. logicRelation 只能使用 model.logicRelationSet\n5. 返回 JSON 结构：{ stages: [{ stageType, nodes:[...] }] }\n\n仅输出 JSON。`,
  },

  optimizeNode: {
    system: '你是教学设计助手。你会根据课程背景优化单个节点，并在需要更新字段时附带 JSON 代码块。',
    user: `请根据课程背景与教师请求，优化当前节点。\n\n课程背景：{{contextJson}}\n模型：{{modelJson}}\n当前节点：{{nodeJson}}\n教师请求：{{userRequest}}\n\n回复要求：\n1. 先给简洁建议\n2. 若要更新字段，在末尾附 JSON 代码块：\n\n\`\`\`json\n{ "updates": { "learningGoal": "..." } }\n\`\`\``,
  },

  generateActivities: {
    system: '你是一位教学活动设计师。你要输出可执行的活动 JSON，并保证活动与执行约束兼容。',
    user: `请为当前节点生成 {{count}} 个活动。\n\n课程背景：{{contextJson}}\n节点信息：{{nodeJson}}\n执行约束：{{constraintsJson}}\n可用模板：{{templatesJson}}\n\n输出 JSON：\n{\n  "activities": [\n    {\n      "activityType": "",\n      "taskDescription": "",\n      "toolRequired": "",\n      "deliverableType": "",\n      "evaluationMode": "",\n      "evaluationRubric": "",\n      "estimatedTime": 5,\n      "templateId": null,\n      "behaviorSequence": [\n        {\n          "behaviorType": "",\n          "behaviorTarget": "",\n          "behaviorTool": "",\n          "behaviorOutput": "",\n          "estimatedTime": 1\n        }\n      ]\n    }\n  ]\n}\n\n仅输出 JSON。`,
  },

  summarizePlan: {
    system: '你是教学方案摘要助手，擅长在 200 字以内给出结构清晰的教学方案总结。',
    user: `请用 200 字以内总结该教学设计，重点说明：教学逻辑、认知递进、核心问题如何被回答。\n\n课程信息：{{contextJson}}\n路径结构：{{pathJson}}`,
  },

  aiPanelGlobalSystem: {
    system: `你是一位专业的教学设计助手。\n规则：\n1. 回答简洁、可执行。\n2. 不重复用户原话。\n3. 涉及字段修改时，在末尾输出 JSON 代码块：{ "updates": { ... } }\n4. 所有建议需符合课程语境和学段。\n\n当前上下文：\n{{contextSnapshot}}`,
    user: `教师请求：{{userInput}}`,
  },
};

export const PROMPT_LABELS: Record<PromptKey, string> = {
  extractContext: 'Step1 提取上下文',
  recommendModel: 'Step2 推荐模型',
  generatePath: 'Step3 生成路径',
  optimizeNode: 'AI 面板节点优化',
  generateActivities: 'Step4 生成活动',
  summarizePlan: 'Step5 摘要生成',
  aiPanelGlobalSystem: 'AI 面板全局提示词',
};

export const PROMPT_VARIABLE_EXAMPLES: Record<PromptKey, { system: string[]; user: string[] }> = {
  extractContext: {
    system: [],
    user: ['{{fileText}}'],
  },
  recommendModel: {
    system: [],
    user: ['{{contextJson}}', '{{modelsJson}}'],
  },
  generatePath: {
    system: [],
    user: ['{{contextJson}}', '{{modelJson}}'],
  },
  optimizeNode: {
    system: [],
    user: ['{{contextJson}}', '{{modelJson}}', '{{nodeJson}}', '{{userRequest}}'],
  },
  generateActivities: {
    system: [],
    user: ['{{count}}', '{{contextJson}}', '{{nodeJson}}', '{{constraintsJson}}', '{{templatesJson}}'],
  },
  summarizePlan: {
    system: [],
    user: ['{{contextJson}}', '{{pathJson}}'],
  },
  aiPanelGlobalSystem: {
    system: ['{{contextSnapshot}}'],
    user: ['{{userInput}}'],
  },
};

export const PROMPT_IMPACTS: Record<PromptKey, PromptImpact> = {
  extractContext: {
    purpose: '控制 Step1 文件解析后如何提取课程核心信息，决定自动填入的上下文质量与完整度。',
    trigger: '上传 txt/md/pdf/docx 后自动触发',
    changeImpact: [
      '会直接改变自动填充的字段内容风格与准确性',
      '会影响后续 Step2/3 的推荐与生成结果质量',
    ],
    affects: ['topic', 'coreQuestion', 'concepts', 'ability', 'competency', 'duration', 'courseType', 'studentGrade', 'studentLevel'],
  },
  recommendModel: {
    purpose: '控制 Step2 模型推荐排序逻辑，决定老师先看到哪个模型与推荐理由。',
    trigger: 'Step2 初次加载且上下文完整时触发',
    changeImpact: [
      '会改变模型卡片排序与推荐理由',
      '会间接影响老师更常选择的路径模型',
    ],
    affects: ['模型卡片排序', '推荐理由文案'],
  },
  generatePath: {
    purpose: '控制 Step3 初始路径实例的生成策略，是路径结构质量最关键的提示词。',
    trigger: '确认模型后触发',
    changeImpact: [
      '会改变阶段内节点数量、逻辑关系与时间分配',
      '会影响 Step4 活动展开时的可编辑基础质量',
    ],
    affects: ['PathInstance.stages', 'Node.learningGoal', 'Node.logicRelation', 'Node.estimatedTime'],
  },
  optimizeNode: {
    purpose: '控制 AI 面板在节点/活动上下文下的优化风格与 JSON patch 输出规范。',
    trigger: '在 node/activity 上下文发送消息时触发',
    changeImpact: [
      '会改变 AI 面板回答方式与可执行建议风格',
      '如果 JSON patch 约束写得不好，可能导致自动应用更新不稳定',
    ],
    affects: ['Node 字段自动更新', 'Activity 字段自动更新', 'AI 面板回复内容'],
  },
  generateActivities: {
    purpose: '控制 Step4 活动生成规则，决定活动可执行性、产出类型和评价设计质量。',
    trigger: '点击按钮后触发',
    changeImpact: [
      '会改变生成活动的任务描述、行为序列与评价标准',
      '会影响与执行约束的兼容过滤结果',
    ],
    affects: ['Activity 列表', 'behaviorSequence', 'templateId', 'evaluationRubric'],
  },
  summarizePlan: {
    purpose: '控制 Step5 教案摘要的表达重点，影响方案对外展示的可读性。',
    trigger: '点击按钮后触发',
    changeImpact: [
      '会改变摘要的长度、侧重点与语言风格',
      '不会改变路径结构本身，只影响展示文本',
    ],
    affects: ['PathInstance.planSummary'],
  },
  aiPanelGlobalSystem: {
    purpose: '控制全局 AI 面板基调与行为边界，是所有 AI 对话的总指令层。',
    trigger: 'AI 面板每次对话都生效',
    changeImpact: [
      '会影响所有上下文下的对话语气与回答格式',
      '会影响 JSON 更新块输出稳定性和字段修改可控性',
    ],
    affects: ['AI 回答风格', 'JSON patch 输出格式', '自动应用更新稳定性'],
  },
};

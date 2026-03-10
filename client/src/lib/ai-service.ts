import { nanoid } from 'nanoid';
import { completeLLM, streamLLM, type LLMMessage } from './llm-client';
import { getRenderedPromptPart } from './prompt-service';
import type {
  Activity,
  ActivityTemplate,
  Context,
  Duration,
  ExecutionConstraints,
  Model,
  Node,
  PathInstance,
  StageInstance,
} from './store';

interface RecommendModelResult {
  rankedModelIds: string[];
  reason: string;
}

interface GeneratePathResult {
  stages: Array<{
    stageType: string;
    nodes: Array<Partial<Node>>;
  }>;
}

interface GenerateActivitiesResult {
  activities: Array<Partial<Activity>>;
}

function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractJsonString(raw: string): string {
  const codeBlockMatch = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim();

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }

  throw new Error('未找到 JSON 结构');
}

function parseJsonObject<T>(raw: string): T {
  const jsonText = extractJsonString(raw);
  let parsed: unknown = JSON.parse(jsonText);

  // 兼容部分模型返回的包装结构：{ content: "{...}", role: "assistant" }
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (typeof record.content === 'string') {
      const inner = tryParseJson(record.content);
      if (inner && typeof inner === 'object') {
        parsed = inner;
      }
    } else if (record.content && typeof record.content === 'object') {
      parsed = record.content;
    }
  }

  return parsed as T;
}

function normalizeDuration(value: unknown): Duration | null {
  if (value == null) return null;
  const n = Number(value);
  if ([35, 40, 60, 90, 120].includes(n)) return n as Duration;
  return null;
}

function inferNodeType(text: string): string {
  if (/实验|参数|运行|调试|训练/i.test(text)) return '实验探究';
  if (/比较|对比/i.test(text)) return '比较分析';
  if (/概括|总结|提炼/i.test(text)) return '抽象总结';
  if (/迁移|应用/i.test(text)) return '迁移应用';
  if (/问题|断言|猜想|原因|推理/i.test(text)) return '因果推断';
  if (/讨论|交流|共议/i.test(text)) return '综合讨论';
  return '概念理解';
}

function normalizeNode(
  node: Partial<Node> & Record<string, unknown>,
  stageId: string,
  allowedRelations: string[]
): Node {
  const title = typeof node.title === 'string' ? node.title : '';
  const description = typeof node.description === 'string' ? node.description : '';
  const goal = typeof node.learningGoal === 'string' && node.learningGoal.trim()
    ? node.learningGoal
    : (title || description);
  const behavior = typeof node.studentBehavior === 'string' && node.studentBehavior.trim()
    ? node.studentBehavior
    : description;
  const support = typeof node.teacherSupportBehavior === 'string' && node.teacherSupportBehavior.trim()
    ? node.teacherSupportBehavior
    : (description ? `引导学生围绕该节点任务完成认知推进：${description}` : '');
  const type = typeof node.nodeType === 'string' && node.nodeType.trim()
    ? node.nodeType
    : inferNodeType(`${title} ${description}`);

  return {
    nodeId: node.nodeId || nanoid(),
    stageId,
    nodeType: type,
    learningGoal: goal,
    studentBehavior: behavior,
    evidenceType: typeof node.evidenceType === 'string' ? node.evidenceType : '',
    teacherSupportBehavior: support,
    estimatedTime: Math.max(3, Math.min(30, Number(node.estimatedTime || 6))),
    logicRelation: allowedRelations.includes(String(node.logicRelation))
      ? String(node.logicRelation)
      : allowedRelations[0] || '建立',
    activities: Array.isArray(node.activities) ? (node.activities as Activity[]) : [],
    expanded: false,
  };
}

function adjustNodeTimes(stages: StageInstance[], duration: Duration | null): StageInstance[] {
  if (!duration) return stages;

  const nodes = stages.flatMap((stage) => stage.nodes);
  if (nodes.length === 0) return stages;

  const current = nodes.reduce((sum, node) => sum + node.estimatedTime, 0);
  if (current <= 0) {
    const avg = Math.max(3, Math.floor(duration / nodes.length));
    nodes.forEach((node) => {
      node.estimatedTime = avg;
    });
  } else {
    const ratio = duration / current;
    nodes.forEach((node) => {
      node.estimatedTime = Math.max(3, Math.round(node.estimatedTime * ratio));
    });
  }

  let total = nodes.reduce((sum, node) => sum + node.estimatedTime, 0);
  let guard = 0;
  while (total !== duration && guard < 200) {
    guard += 1;
    const diff = duration - total;
    const target = nodes[guard % nodes.length];
    if (diff > 0) {
      target.estimatedTime += 1;
      total += 1;
    } else if (target.estimatedTime > 3) {
      target.estimatedTime -= 1;
      total -= 1;
    }
  }

  return stages;
}

function behaviorCompatibleWithConstraints(behaviorType: string, constraints: ExecutionConstraints): boolean {
  const requiresComputer = ['运行程序', '修改参数', '观察输出', '调试程序', '构建简单模型'];
  const requiresGroup = ['小组讨论', '共同整理', '互相评价'];
  const requiresWholeClass = ['展示结果', '集体汇报'];

  if (requiresComputer.includes(behaviorType) && constraints.deviceType !== '电脑') {
    return false;
  }
  if (requiresGroup.includes(behaviorType) && constraints.spaceMode === '个体') {
    return false;
  }
  if (requiresWholeClass.includes(behaviorType) && constraints.spaceMode !== '全班') {
    return false;
  }
  if (requiresWholeClass.includes(behaviorType) && constraints.managementLevel === '低') {
    return false;
  }
  return true;
}

export async function extractContextByLLM(fileText: string): Promise<Partial<Context>> {
  const vars = { fileText: fileText.slice(0, 20000) };
  const systemPrompt = getRenderedPromptPart('extractContext', 'system', vars);
  const userPrompt = getRenderedPromptPart('extractContext', 'user', vars);
  const content = await completeLLM({
    temperature: 0.2,
    jsonMode: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const parsed = parseJsonObject<Record<string, unknown>>(content);
  const studentGrades = ['小低（1-3年级）', '小高（4-6年级）', '初中', '高中', '中职', '高职', '大学本科'];
  const studentGrade =
    parsed.studentGrade && studentGrades.includes(String(parsed.studentGrade))
      ? (String(parsed.studentGrade) as Context['studentGrade'])
      : null;

  return {
    topic: String(parsed.topic || ''),
    coreQuestion: String(parsed.coreQuestion || ''),
    concepts: Array.isArray(parsed.concepts)
      ? parsed.concepts.map((item) => String(item)).filter(Boolean)
      : [],
    ability: String(parsed.ability || ''),
    competency: String(parsed.competency || ''),
    duration: normalizeDuration(parsed.duration),
    courseType:
      parsed.courseType === '概念建构' || parsed.courseType === '自主探究'
        ? parsed.courseType
        : null,
    studentGrade,
    studentLevel:
      parsed.studentLevel === '基础' ||
      parsed.studentLevel === '中等' ||
      parsed.studentLevel === '进阶'
        ? parsed.studentLevel
        : null,
  };
}

export async function recommendModelByLLM(
  context: Context,
  availableModels: Model[]
): Promise<RecommendModelResult> {
  const vars = {
    contextJson: context,
    modelsJson: availableModels,
  };
  const systemPrompt = getRenderedPromptPart('recommendModel', 'system', vars);
  const userPrompt = getRenderedPromptPart('recommendModel', 'user', vars);

  const content = await completeLLM({
    temperature: 0.3,
    jsonMode: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const parsed = parseJsonObject<RecommendModelResult>(content);
  const ranked = Array.isArray(parsed.rankedModelIds)
    ? parsed.rankedModelIds.filter(Boolean)
    : [];

  return {
    rankedModelIds: ranked,
    reason: parsed.reason || '',
  };
}

export async function generatePathByLLM(
  context: Context,
  model: Model
): Promise<PathInstance> {
  const vars = {
    contextJson: context,
    modelJson: model,
  };
  const systemPrompt = getRenderedPromptPart('generatePath', 'system', vars);
  const userPrompt = getRenderedPromptPart('generatePath', 'user', vars);

  const content = await completeLLM({
    temperature: 0.5,
    jsonMode: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const parsed = parseJsonObject<GeneratePathResult>(content);
  const rawStages = Array.isArray(parsed.stages) ? parsed.stages : [];

  const stageMap = new Map(rawStages.map((stage) => [stage.stageType, stage]));
  const stages: StageInstance[] = model.stages.map((stageType, index) => {
    const hit = stageMap.get(stageType);
    const rawNodes = hit?.nodes?.length ? hit.nodes : [{}];

    return {
      stageId: `stage-${index}`,
      stageType,
      stageOrder: index + 1,
      nodes: rawNodes.map((node) =>
        normalizeNode(node as Partial<Node> & Record<string, unknown>, `stage-${index}`, model.logicRelationSet)
      ),
    };
  });

  adjustNodeTimes(stages, context.duration);

  return {
    modelId: model.modelId,
    duration: context.duration,
    stages,
    status: '草稿',
    executionNotes: '',
    actualTimeUsed: {},
    revisionTrigger: '',
    planSummary: '',
  };
}

export async function generateActivitiesByLLM(params: {
  context: Context;
  node: Node;
  templates: ActivityTemplate[];
  count: number;
}): Promise<Activity[]> {
  const { context, node, templates, count } = params;

  const vars = {
    count,
    contextJson: context,
    nodeJson: node,
    constraintsJson: context.executionConstraints,
    templatesJson: templates,
  };
  const systemPrompt = getRenderedPromptPart('generateActivities', 'system', vars);
  const userPrompt = getRenderedPromptPart('generateActivities', 'user', vars);

  const content = await completeLLM({
    temperature: 0.6,
    jsonMode: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const parsed = parseJsonObject<GenerateActivitiesResult>(content);
  const rawList = Array.isArray(parsed.activities) ? parsed.activities : [];

  return rawList.map((item) => {
    const sequence = Array.isArray(item.behaviorSequence)
      ? item.behaviorSequence.filter((behavior) =>
          behaviorCompatibleWithConstraints(
            String(behavior.behaviorType || ''),
            context.executionConstraints
          )
        )
      : [];

    return {
      activityId: nanoid(),
      nodeId: node.nodeId,
      templateId: item.templateId ? String(item.templateId) : null,
      activityType: String(item.activityType || '讨论表达'),
      taskDescription: String(item.taskDescription || ''),
      toolRequired: String(item.toolRequired || '无'),
      deliverableType: String(item.deliverableType || '文本'),
      evaluationMode: String(item.evaluationMode || '人工评价'),
      evaluationRubric: String(item.evaluationRubric || ''),
      estimatedTime: Math.max(3, Math.min(25, Number(item.estimatedTime || 5))),
      behaviorSequence: sequence.map((behavior) => ({
        behaviorType: String(behavior.behaviorType || ''),
        behaviorTarget: String(behavior.behaviorTarget || ''),
        behaviorTool: String(behavior.behaviorTool || ''),
        behaviorOutput: String(behavior.behaviorOutput || ''),
        estimatedTime: Math.max(1, Math.min(15, Number(behavior.estimatedTime || 1))),
      })),
    };
  });
}

export async function summarizePlanByLLM(
  context: Context,
  pathInstance: PathInstance
): Promise<string> {
  const vars = {
    contextJson: context,
    pathJson: pathInstance,
  };
  const systemPrompt = getRenderedPromptPart('summarizePlan', 'system', vars);
  const userPrompt = getRenderedPromptPart('summarizePlan', 'user', vars);

  return completeLLM({
    temperature: 0.4,
    maxTokens: 400,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
}

export async function streamAIPanelByLLM(params: {
  history: LLMMessage[];
  contextSnapshot: Record<string, unknown>;
  userInput: string;
  temperature?: number;
  onToken: (token: string) => void;
}): Promise<string> {
  const vars = {
    contextSnapshot: params.contextSnapshot,
    userInput: params.userInput,
  };
  const systemPrompt = getRenderedPromptPart('aiPanelGlobalSystem', 'system', vars);
  const userPrompt = getRenderedPromptPart('aiPanelGlobalSystem', 'user', vars);

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    ...params.history,
    {
      role: 'user',
      content: userPrompt,
    },
  ];

  let fullText = '';
  await streamLLM({
    messages,
    temperature: params.temperature ?? 0.7,
    onToken: (token) => {
      fullText += token;
      params.onToken(token);
    },
    onDone: () => {
      // no-op
    },
  });

  return fullText;
}

export function parseUpdatePayloadFromReply(reply: string): Record<string, unknown> | null {
  const match = reply.match(/```json\s*([\s\S]*?)\s*```/i);
  if (!match?.[1]) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && typeof parsed === 'object') {
      if (parsed.updates && typeof parsed.updates === 'object') {
        return parsed.updates as Record<string, unknown>;
      }
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

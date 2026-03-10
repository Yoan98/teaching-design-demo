// 教学活动设计模块 — 全局状态管理（V2）
// 设计哲学：结构先于内容，强制线性流程，纯前端本地持久化

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { migratePersistedAppState } from './storage';

// ─── 类型定义 ───────────────────────────────────────────────

export type Duration = 35 | 40 | 60 | 90 | 120;
export type CourseType = '概念建构' | '自主探究';
export type StudentGrade = '小低（1-3年级）' | '小高（4-6年级）' | '初中' | '高中' | '中职' | '高职' | '大学本科';
export type StudentLevel = '基础' | '中等' | '进阶';
export type PathStatus = '草稿' | '确认' | '发布' | '已使用' | '已归档';
export type ActivityTemplateSource = '系统预置' | '教师创建' | '社区推荐';

export type DeviceType = '无设备' | '平板' | '电脑';
export type SoftwareEnvironment = '浏览器' | 'Python环境' | 'AI平台';
export type MaterialLevel = '无材料' | '简单材料（纸笔）' | '需提前准备' | '需购买';
export type PreparationCost = '无准备' | '课前5分钟' | '课前30分钟';
export type SpaceMode = '个体' | '小组' | '全班';
export type ManagementLevel = '低' | '中' | '高';
export type CostLevel = 0 | '低' | '需预算';

export interface ExecutionConstraints {
  deviceType: DeviceType;
  softwareEnvironment: SoftwareEnvironment;
  materialLevel: MaterialLevel;
  prepTime: PreparationCost;
  spaceMode: SpaceMode;
  managementLevel: ManagementLevel;
  costLevel: CostLevel;
}

export interface LearningBehavior {
  behaviorType: string;
  behaviorTarget: string;
  behaviorTool: string;
  behaviorOutput: string;
  estimatedTime: number;
}

export interface Context {
  topic: string;
  coreQuestion: string;
  concepts: string[];
  ability: string;
  competency: string;
  duration: Duration | null;
  courseType: CourseType | null;
  studentGrade: StudentGrade | null;
  studentLevel: StudentLevel | null;
  studentProfileId: string | null;
  executionConstraints: ExecutionConstraints;
  // 锁定状态
  block1Locked: boolean;
  block2Locked: boolean;
  block3Locked: boolean;
}

export interface Model {
  modelId: string;
  modelName: string;
  stages: string[];
  suggestedNodeRange: string;
  suggestedRhythm: string;
  description: string;
  logicRelationSet: string[];
}

export interface Activity {
  activityId: string;
  nodeId: string;
  templateId: string | null;
  activityType: string;
  taskDescription: string;
  toolRequired: string;
  deliverableType: string;
  evaluationMode: string;
  evaluationRubric: string;
  estimatedTime: number;
  behaviorSequence: LearningBehavior[];
}

export interface ActivityTemplate {
  templateId: string;
  templateName: string;
  activityType: string;
  applicableNodeTypes: string[];
  behaviorSequence: LearningBehavior[];
  taskDescriptionTemplate: string;
  toolRequired: string;
  deliverableType: string;
  evaluationMode: string;
  evaluationRubric: string;
  source: ActivityTemplateSource;
  usageCount: number;
}

export interface Node {
  nodeId: string;
  stageId: string;
  nodeType: string;
  learningGoal: string;
  studentBehavior: string;
  evidenceType: string;
  teacherSupportBehavior: string;
  estimatedTime: number;
  logicRelation: string;
  activities: Activity[];
  expanded: boolean;
}

export interface StageInstance {
  stageId: string;
  stageType: string;
  stageOrder: number;
  nodes: Node[];
}

export interface PathInstance {
  modelId: string;
  duration: Duration | null;
  stages: StageInstance[];
  status: PathStatus;
  executionNotes: string;
  actualTimeUsed: Record<string, number>;
  revisionTrigger: string;
  planSummary: string;
}

export type Step = 1 | 2 | 3 | 4 | 5;

export interface AppState {
  currentStep: Step;
  context: Context;
  selectedModel: Model | null;
  pathInstance: PathInstance;
  activityTemplates: ActivityTemplate[];
  // 操作方法
  setStep: (step: Step) => void;
  updateContext: (partial: Partial<Context>) => void;
  updateExecutionConstraints: (partial: Partial<ExecutionConstraints>) => void;
  lockBlock: (block: 1 | 2 | 3) => void;
  selectModel: (model: Model) => void;
  setPathInstance: (pi: PathInstance) => void;
  setNodeActivities: (nodeId: string, activities: Activity[]) => void;
  addNode: (stageId: string) => void;
  updateNode: (nodeId: string, partial: Partial<Node>) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, direction: 'up' | 'down') => void;
  toggleNodeExpanded: (nodeId: string) => void;
  addActivity: (nodeId: string) => void;
  updateActivity: (activityId: string, partial: Partial<Activity>) => void;
  deleteActivity: (activityId: string) => void;
  applyActivityTemplateToNode: (nodeId: string, templateId: string) => void;
  saveActivityAsTemplate: (activityId: string, templateName: string) => void;
  setPathStatus: (status: PathStatus) => void;
  setPathExecutionMeta: (partial: Partial<Pick<PathInstance, 'executionNotes' | 'revisionTrigger' | 'actualTimeUsed'>>) => void;
  setPlanSummary: (summary: string) => void;
}

// ─── 默认数据 ───────────────────────────────────────────────

const defaultExecutionConstraints: ExecutionConstraints = {
  deviceType: '无设备',
  softwareEnvironment: '浏览器',
  materialLevel: '简单材料（纸笔）',
  prepTime: '无准备',
  spaceMode: '个体',
  managementLevel: '中',
  costLevel: 0,
};

const defaultContext: Context = {
  topic: '',
  coreQuestion: '',
  concepts: [],
  ability: '',
  competency: '',
  duration: null,
  courseType: null,
  studentGrade: null,
  studentLevel: null,
  studentProfileId: null,
  executionConstraints: defaultExecutionConstraints,
  block1Locked: false,
  block2Locked: false,
  block3Locked: false,
};

const defaultPathInstance: PathInstance = {
  modelId: '',
  duration: null,
  stages: [],
  status: '草稿',
  executionNotes: '',
  actualTimeUsed: {},
  revisionTrigger: '',
  planSummary: '',
};

const defaultActivityTemplates: ActivityTemplate[] = [
  {
    templateId: 'tpl_param_experiment_001',
    templateName: '参数实验型',
    activityType: '参数测试',
    applicableNodeTypes: ['实验探究', '变量控制', '实验操作'],
    behaviorSequence: [
      {
        behaviorType: '运行程序',
        behaviorTarget: '实验对象',
        behaviorTool: 'Python 编辑器',
        behaviorOutput: '初始结果截图',
        estimatedTime: 2,
      },
      {
        behaviorType: '修改参数',
        behaviorTarget: '关键参数',
        behaviorTool: 'Python 编辑器',
        behaviorOutput: '新结果截图',
        estimatedTime: 2,
      },
      {
        behaviorType: '比较差异',
        behaviorTarget: '两次实验结果',
        behaviorTool: '学习单',
        behaviorOutput: '对比记录',
        estimatedTime: 2,
      },
    ],
    taskDescriptionTemplate: '在{{time}}分钟内，以个人完成参数调整实验并提交对比记录。',
    toolRequired: 'Python 编辑器',
    deliverableType: '图片',
    evaluationMode: '人工评价',
    evaluationRubric: '操作步骤正确；对比结论合理',
    source: '系统预置',
    usageCount: 0,
  },
  {
    templateId: 'tpl_contrast_analysis_001',
    templateName: '对比分析型',
    activityType: '讨论表达',
    applicableNodeTypes: ['比较分析', '综合讨论', '解释推理'],
    behaviorSequence: [
      {
        behaviorType: '阅读材料',
        behaviorTarget: '案例材料',
        behaviorTool: '课程材料',
        behaviorOutput: '关键信息标记',
        estimatedTime: 2,
      },
      {
        behaviorType: '比较差异',
        behaviorTarget: '两个对象',
        behaviorTool: '学习单',
        behaviorOutput: '对比表格',
        estimatedTime: 3,
      },
      {
        behaviorType: '小组讨论',
        behaviorTarget: '差异原因',
        behaviorTool: '白板工具',
        behaviorOutput: '小组观点',
        estimatedTime: 2,
      },
    ],
    taskDescriptionTemplate: '在{{time}}分钟内，小组完成对比表并给出1条结论。',
    toolRequired: '无',
    deliverableType: '文本',
    evaluationMode: '同伴互评',
    evaluationRubric: '比较维度完整；论证有依据',
    source: '系统预置',
    usageCount: 0,
  },
];

function createDefaultActivity(nodeId: string): Activity {
  return {
    activityId: nanoid(),
    nodeId,
    templateId: null,
    activityType: '讨论表达',
    taskDescription: '',
    toolRequired: '无',
    deliverableType: '文本',
    evaluationMode: '人工评价',
    evaluationRubric: '',
    estimatedTime: 3,
    behaviorSequence: [],
  };
}

// ─── Store ───────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      context: defaultContext,
      selectedModel: null,
      pathInstance: defaultPathInstance,
      activityTemplates: defaultActivityTemplates,

      setStep: (step) => set({ currentStep: step }),

      updateContext: (partial) =>
        set((state) => ({ context: { ...state.context, ...partial } })),

      updateExecutionConstraints: (partial) =>
        set((state) => ({
          context: {
            ...state.context,
            executionConstraints: {
              ...state.context.executionConstraints,
              ...partial,
            },
          },
        })),

      lockBlock: (block) =>
        set((state) => ({
          context: {
            ...state.context,
            block1Locked: block === 1 ? true : state.context.block1Locked,
            block2Locked: block === 2 ? true : state.context.block2Locked,
            block3Locked: block === 3 ? true : state.context.block3Locked,
          },
        })),

      selectModel: (model) => set({ selectedModel: model }),

      setPathInstance: (pi) => set({ pathInstance: pi }),

      setNodeActivities: (nodeId, activities) =>
        set((state) => {
          const stages = state.pathInstance.stages.map((stage) => ({
            ...stage,
            nodes: stage.nodes.map((node) =>
              node.nodeId === nodeId ? { ...node, activities } : node
            ),
          }));
          return { pathInstance: { ...state.pathInstance, stages } };
        }),

      addNode: (stageId) =>
        set((state) => {
          const firstRelation =
            state.selectedModel?.logicRelationSet[0] || '建立';
          const stages = state.pathInstance.stages.map((stage) => {
            if (stage.stageId !== stageId) return stage;
            const newNode: Node = {
              nodeId: nanoid(),
              stageId,
              nodeType: '概念理解',
              learningGoal: '',
              studentBehavior: '',
              evidenceType: '',
              teacherSupportBehavior: '',
              estimatedTime: 5,
              logicRelation: firstRelation,
              activities: [],
              expanded: false,
            };
            return { ...stage, nodes: [...stage.nodes, newNode] };
          });
          return { pathInstance: { ...state.pathInstance, stages } };
        }),

      updateNode: (nodeId, partial) =>
        set((state) => {
          const stages = state.pathInstance.stages.map((stage) => ({
            ...stage,
            nodes: stage.nodes.map((node) =>
              node.nodeId === nodeId ? { ...node, ...partial } : node
            ),
          }));
          return { pathInstance: { ...state.pathInstance, stages } };
        }),

      deleteNode: (nodeId) =>
        set((state) => {
          const stages = state.pathInstance.stages.map((stage) => ({
            ...stage,
            nodes: stage.nodes.filter((node) => node.nodeId !== nodeId),
          }));
          return { pathInstance: { ...state.pathInstance, stages } };
        }),

      moveNode: (nodeId, direction) =>
        set((state) => {
          const stages = state.pathInstance.stages.map((stage) => {
            const idx = stage.nodes.findIndex((n) => n.nodeId === nodeId);
            if (idx === -1) return stage;
            const nodes = [...stage.nodes];
            if (direction === 'up' && idx > 0) {
              [nodes[idx - 1], nodes[idx]] = [nodes[idx], nodes[idx - 1]];
            } else if (direction === 'down' && idx < nodes.length - 1) {
              [nodes[idx], nodes[idx + 1]] = [nodes[idx + 1], nodes[idx]];
            }
            return { ...stage, nodes };
          });
          return { pathInstance: { ...state.pathInstance, stages } };
        }),

      toggleNodeExpanded: (nodeId) =>
        set((state) => {
          const stages = state.pathInstance.stages.map((stage) => ({
            ...stage,
            nodes: stage.nodes.map((node) =>
              node.nodeId === nodeId
                ? { ...node, expanded: !node.expanded }
                : node
            ),
          }));
          return { pathInstance: { ...state.pathInstance, stages } };
        }),

      addActivity: (nodeId) =>
        set((state) => {
          const stages = state.pathInstance.stages.map((stage) => ({
            ...stage,
            nodes: stage.nodes.map((node) =>
              node.nodeId === nodeId
                ? {
                    ...node,
                    activities: [...node.activities, createDefaultActivity(nodeId)],
                  }
                : node
            ),
          }));
          return { pathInstance: { ...state.pathInstance, stages } };
        }),

      updateActivity: (activityId, partial) =>
        set((state) => {
          const stages = state.pathInstance.stages.map((stage) => ({
            ...stage,
            nodes: stage.nodes.map((node) => ({
              ...node,
              activities: node.activities.map((act) =>
                act.activityId === activityId ? { ...act, ...partial } : act
              ),
            })),
          }));
          return { pathInstance: { ...state.pathInstance, stages } };
        }),

      deleteActivity: (activityId) =>
        set((state) => {
          const stages = state.pathInstance.stages.map((stage) => ({
            ...stage,
            nodes: stage.nodes.map((node) => ({
              ...node,
              activities: node.activities.filter(
                (act) => act.activityId !== activityId
              ),
            })),
          }));
          return { pathInstance: { ...state.pathInstance, stages } };
        }),

      applyActivityTemplateToNode: (nodeId, templateId) =>
        set((state) => {
          const template = state.activityTemplates.find(
            (item) => item.templateId === templateId
          );
          if (!template) return {} as Partial<AppState>;

          const stages = state.pathInstance.stages.map((stage) => ({
            ...stage,
            nodes: stage.nodes.map((node) => {
              if (node.nodeId !== nodeId) return node;
              const activity: Activity = {
                activityId: nanoid(),
                nodeId,
                templateId,
                activityType: template.activityType,
                taskDescription: template.taskDescriptionTemplate.replace('{{time}}', String(node.estimatedTime)),
                toolRequired: template.toolRequired,
                deliverableType: template.deliverableType,
                evaluationMode: template.evaluationMode,
                evaluationRubric: template.evaluationRubric,
                estimatedTime: Math.max(3, Math.floor(node.estimatedTime / 2)),
                behaviorSequence: template.behaviorSequence,
              };
              return {
                ...node,
                activities: [...node.activities, activity],
              };
            }),
          }));

          const templates = state.activityTemplates.map((item) =>
            item.templateId === templateId
              ? { ...item, usageCount: item.usageCount + 1 }
              : item
          );

          return {
            pathInstance: { ...state.pathInstance, stages },
            activityTemplates: templates,
          };
        }),

      saveActivityAsTemplate: (activityId, templateName) =>
        set((state) => {
          let target: Activity | null = null;
          let nodeType = '综合讨论';

          for (const stage of state.pathInstance.stages) {
            for (const node of stage.nodes) {
              const found = node.activities.find((act) => act.activityId === activityId);
              if (found) {
                target = found;
                nodeType = node.nodeType;
                break;
              }
            }
            if (target) break;
          }

          if (!target) return {} as Partial<AppState>;

          const template: ActivityTemplate = {
            templateId: `tpl_custom_${nanoid(8)}`,
            templateName,
            activityType: target.activityType,
            applicableNodeTypes: [nodeType],
            behaviorSequence: target.behaviorSequence,
            taskDescriptionTemplate: target.taskDescription || '在{{time}}分钟内完成任务，并提交结果。',
            toolRequired: target.toolRequired,
            deliverableType: target.deliverableType,
            evaluationMode: target.evaluationMode,
            evaluationRubric: target.evaluationRubric,
            source: '教师创建',
            usageCount: 0,
          };

          return {
            activityTemplates: [template, ...state.activityTemplates],
          };
        }),

      setPathStatus: (status) =>
        set((state) => ({
          pathInstance: { ...state.pathInstance, status },
        })),

      setPathExecutionMeta: (partial) =>
        set((state) => ({
          pathInstance: {
            ...state.pathInstance,
            ...partial,
            actualTimeUsed: {
              ...state.pathInstance.actualTimeUsed,
              ...partial.actualTimeUsed,
            },
          },
        })),

      setPlanSummary: (summary) =>
        set((state) => ({
          pathInstance: { ...state.pathInstance, planSummary: summary },
        })),
    }),
    {
      name: 'teaching-design-app-v2',
      version: 2,
      migrate: migratePersistedAppState,
      partialize: (state) => ({
        currentStep: state.currentStep,
        context: state.context,
        selectedModel: state.selectedModel,
        pathInstance: state.pathInstance,
        activityTemplates: state.activityTemplates,
      }),
    }
  )
);

// ─── 预置模型数据 ─────────────────────────────────────────────

export const PRESET_MODELS: Model[] = [
  {
    modelId: 'cognitive-revision',
    modelName: '认知修订模型',
    stages: ['明确认知对象', '观察认知对象', '提出个体断言', '小组交流与初步修订', '班级共议与再修订', '持续修订并记录', '概括提升与提炼'],
    suggestedNodeRange: '5-7',
    suggestedRhythm: '前慢后快',
    logicRelationSet: ['建立', '对比', '推翻', '应用'],
    description: '适合概念建构类课程，通过多轮修订推动认知深化。学生从个体认知出发，经由小组与班级讨论，逐步形成共识性理解。',
  },
  {
    modelId: 'problem-solving',
    modelName: '问题解决模型',
    stages: ['问题建构', '方案探索', '实验验证', '结果分析', '迁移应用'],
    suggestedNodeRange: '4-6',
    suggestedRhythm: '均匀分布',
    logicRelationSet: ['建立', '分解', '验证', '迁移', '应用'],
    description: '适合探究式课程，以核心问题为驱动，引导学生经历完整的问题解决过程，培养系统性思维。',
  },
  {
    modelId: 'inquiry-based',
    modelName: '探究学习模型',
    stages: ['情境导入', '提出假设', '设计实验', '收集数据', '得出结论', '反思评价'],
    suggestedNodeRange: '5-8',
    suggestedRhythm: '中间密集',
    logicRelationSet: ['建立', '假设', '验证', '修正', '推广'],
    description: '适合实验性、数据驱动类课程，强调学生自主设计探究方案，培养科学思维与实证精神。',
  },
];

// ─── 辅助函数 ─────────────────────────────────────────────────

export function getTotalTime(pathInstance: PathInstance): number {
  return pathInstance.stages.reduce((total, stage) => {
    return total + stage.nodes.reduce((t, node) => t + node.estimatedTime, 0);
  }, 0);
}

export function getNodeTotalActivityTime(node: Node): number {
  return node.activities.reduce((t, act) => t + act.estimatedTime, 0);
}

export function getNodeTypeColor(nodeType: string): string {
  const map: Record<string, string> = {
    概念理解: 'bg-blue-100 text-blue-700',
    比较分析: 'bg-purple-100 text-purple-700',
    实验探究: 'bg-green-100 text-green-700',
    因果推断: 'bg-orange-100 text-orange-700',
    综合讨论: 'bg-yellow-100 text-yellow-700',
    抽象总结: 'bg-indigo-100 text-indigo-700',
    迁移应用: 'bg-pink-100 text-pink-700',
    问题建构: 'bg-cyan-100 text-cyan-700',
    变量控制: 'bg-teal-100 text-teal-700',
    解释推理: 'bg-violet-100 text-violet-700',
    实验操作: 'bg-emerald-100 text-emerald-700',
  };
  return map[nodeType] || 'bg-gray-100 text-gray-700';
}

export function getLogicRelationColor(relation: string): string {
  const map: Record<string, string> = {
    建立: 'text-blue-600',
    对比: 'text-purple-600',
    推翻: 'text-red-600',
    应用: 'text-green-600',
    分解: 'text-cyan-600',
    验证: 'text-orange-600',
    迁移: 'text-pink-600',
    假设: 'text-indigo-600',
    修正: 'text-amber-600',
    推广: 'text-teal-600',
  };
  return map[relation] || 'text-gray-600';
}

export function generateSampleData(
  modelId: string,
  stages: string[],
  duration: Duration
): PathInstance {
  const model = PRESET_MODELS.find((item) => item.modelId === modelId);
  const relations = model?.logicRelationSet || ['建立', '应用'];

  const stageInstances: StageInstance[] = stages.slice(0, 5).map((stageName, idx) => {
    const nodes: Node[] = [];
    if (idx === 0) {
      nodes.push({
        nodeId: nanoid(),
        stageId: `stage-${idx}`,
        nodeType: '概念理解',
        learningGoal: '识别三次浪潮时间与技术特征',
        studentBehavior: '阅读材料并整理时间线',
        evidenceType: '时间线图',
        teacherSupportBehavior: '提供结构化阅读材料，引导学生关注关键时间节点',
        estimatedTime: 8,
        logicRelation: relations[0] || '建立',
        activities: [],
        expanded: false,
      });
    } else if (idx === 1) {
      nodes.push({
        nodeId: nanoid(),
        stageId: `stage-${idx}`,
        nodeType: '比较分析',
        learningGoal: '比较三次浪潮技术差异',
        studentBehavior: '填写对比表格',
        evidenceType: '对比表格',
        teacherSupportBehavior: '提供对比维度框架，引导学生聚焦算力、数据、算法三个维度',
        estimatedTime: 8,
        logicRelation: relations[1] || relations[0] || '建立',
        activities: [],
        expanded: false,
      });
    } else if (idx === 2) {
      nodes.push({
        nodeId: nanoid(),
        stageId: `stage-${idx}`,
        nodeType: '因果推断',
        learningGoal: '分析第一次低谷原因',
        studentBehavior: '提出个人断言并说明理由',
        evidenceType: '分析文字',
        teacherSupportBehavior: '引导学生从技术局限性和社会期望落差两个角度分析',
        estimatedTime: 8,
        logicRelation: relations[0] || '建立',
        activities: [],
        expanded: false,
      });
    } else if (idx === 3) {
      nodes.push({
        nodeId: nanoid(),
        stageId: `stage-${idx}`,
        nodeType: '综合讨论',
        learningGoal: '分析技术与社会环境关系',
        studentBehavior: '班级共议，修订个人断言',
        evidenceType: '讨论记录',
        teacherSupportBehavior: '组织班级讨论，引导学生关注技术与社会条件的相互作用',
        estimatedTime: 8,
        logicRelation: relations[relations.length - 1] || '应用',
        activities: [],
        expanded: false,
      });
    } else if (idx === 4) {
      nodes.push({
        nodeId: nanoid(),
        stageId: `stage-${idx}`,
        nodeType: '抽象总结',
        learningGoal: '概括技术发展周期规律',
        studentBehavior: '提炼规律性认识',
        evidenceType: '总结文字',
        teacherSupportBehavior: '引导学生从具体案例抽象出一般规律',
        estimatedTime: 8,
        logicRelation: relations[relations.length - 1] || '应用',
        activities: [],
        expanded: false,
      });
    }

    return {
      stageId: `stage-${idx}`,
      stageType: stageName,
      stageOrder: idx + 1,
      nodes,
    };
  });

  return {
    modelId,
    duration,
    stages: stageInstances,
    status: '草稿',
    executionNotes: '',
    actualTimeUsed: {},
    revisionTrigger: '',
    planSummary: '',
  };
}

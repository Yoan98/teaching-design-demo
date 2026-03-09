// 教学活动设计模块 — 全局状态管理
// 设计哲学：新功能主义，强制线性流程，状态驱动 UI

import { create } from 'zustand';
import { nanoid } from 'nanoid';

// ─── 类型定义 ───────────────────────────────────────────────

export type Duration = 35 | 40 | 60 | 90 | 120;
export type CourseType = '概念建构' | '自主探究';
export type StudentGrade = '小低（1-3年级）' | '小高（4-6年级）' | '初中' | '高中' | '中职' | '高职' | '大学本科';
export type LogicRelation = '建立' | '对比' | '推翻' | '应用';
export type PathStatus = '草稿' | '确认' | '发布';

export interface Context {
  topic: string;
  coreQuestion: string;
  concepts: string[];
  ability: string;
  competency: string;
  duration: Duration | null;
  courseType: CourseType | null;
  studentGrade: StudentGrade | null;
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
}

export interface Activity {
  activityId: string;
  nodeId: string;
  activityType: string;
  taskDescription: string;
  toolRequired: string;
  deliverableType: string;
  evaluationMode: string;
  evaluationRubric: string;
  estimatedTime: number;
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
  logicRelation: LogicRelation;
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
}

export type Step = 1 | 2 | 3 | 4 | 5;

export interface AppState {
  currentStep: Step;
  context: Context;
  selectedModel: Model | null;
  pathInstance: PathInstance;
  // 操作方法
  setStep: (step: Step) => void;
  updateContext: (partial: Partial<Context>) => void;
  lockBlock: (block: 1 | 2 | 3) => void;
  selectModel: (model: Model) => void;
  setPathInstance: (pi: PathInstance) => void;
  addNode: (stageId: string) => void;
  updateNode: (nodeId: string, partial: Partial<Node>) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, direction: 'up' | 'down') => void;
  toggleNodeExpanded: (nodeId: string) => void;
  addActivity: (nodeId: string) => void;
  updateActivity: (activityId: string, partial: Partial<Activity>) => void;
  deleteActivity: (activityId: string) => void;
  setPathStatus: (status: PathStatus) => void;
}

// ─── 默认数据 ───────────────────────────────────────────────

const defaultContext: Context = {
  topic: '',
  coreQuestion: '',
  concepts: [],
  ability: '',
  competency: '',
  duration: null,
  courseType: null,
  studentGrade: null,
  block1Locked: false,
  block2Locked: false,
  block3Locked: false,
};

const defaultPathInstance: PathInstance = {
  modelId: '',
  duration: null,
  stages: [],
  status: '草稿',
};

// ─── Store ───────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  currentStep: 1,
  context: defaultContext,
  selectedModel: null,
  pathInstance: defaultPathInstance,

  setStep: (step) => set({ currentStep: step }),

  updateContext: (partial) =>
    set((state) => ({ context: { ...state.context, ...partial } })),

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

  addNode: (stageId) =>
    set((state) => {
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
          logicRelation: '建立',
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
          node.nodeId === nodeId ? { ...node, expanded: !node.expanded } : node
        ),
      }));
      return { pathInstance: { ...state.pathInstance, stages } };
    }),

  addActivity: (nodeId) =>
    set((state) => {
      const newActivity: Activity = {
        activityId: nanoid(),
        nodeId,
        activityType: '讨论表达',
        taskDescription: '',
        toolRequired: '无',
        deliverableType: '文本',
        evaluationMode: '人工评价',
        evaluationRubric: '',
        estimatedTime: 3,
      };
      const stages = state.pathInstance.stages.map((stage) => ({
        ...stage,
        nodes: stage.nodes.map((node) =>
          node.nodeId === nodeId
            ? { ...node, activities: [...node.activities, newActivity] }
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

  setPathStatus: (status) =>
    set((state) => ({
      pathInstance: { ...state.pathInstance, status },
    })),
}));

// ─── 预置模型数据 ─────────────────────────────────────────────

export const PRESET_MODELS: Model[] = [
  {
    modelId: 'cognitive-revision',
    modelName: '认知修订模型',
    stages: ['明确认知对象', '观察认知对象', '提出个体断言', '小组交流与初步修订', '班级共议与再修订', '持续修订并记录', '概括提升与提炼'],
    suggestedNodeRange: '5-7',
    suggestedRhythm: '前慢后快',
    description: '适合概念建构类课程，通过多轮修订推动认知深化。学生从个体认知出发，经由小组与班级讨论，逐步形成共识性理解。',
  },
  {
    modelId: 'problem-solving',
    modelName: '问题解决模型',
    stages: ['问题建构', '方案探索', '实验验证', '结果分析', '迁移应用'],
    suggestedNodeRange: '4-6',
    suggestedRhythm: '均匀分布',
    description: '适合探究式课程，以核心问题为驱动，引导学生经历完整的问题解决过程，培养系统性思维。',
  },
  {
    modelId: 'inquiry-based',
    modelName: '探究学习模型',
    stages: ['情境导入', '提出假设', '设计实验', '收集数据', '得出结论', '反思评价'],
    suggestedNodeRange: '5-8',
    suggestedRhythm: '中间密集',
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
    '概念理解': 'bg-blue-100 text-blue-700',
    '比较分析': 'bg-purple-100 text-purple-700',
    '实验探究': 'bg-green-100 text-green-700',
    '因果推断': 'bg-orange-100 text-orange-700',
    '综合讨论': 'bg-yellow-100 text-yellow-700',
    '抽象总结': 'bg-indigo-100 text-indigo-700',
    '迁移应用': 'bg-pink-100 text-pink-700',
    '问题建构': 'bg-cyan-100 text-cyan-700',
    '变量控制': 'bg-teal-100 text-teal-700',
    '解释推理': 'bg-violet-100 text-violet-700',
    '实验操作': 'bg-emerald-100 text-emerald-700',
  };
  return map[nodeType] || 'bg-gray-100 text-gray-700';
}

export function getLogicRelationColor(relation: LogicRelation): string {
  const map: Record<LogicRelation, string> = {
    '建立': 'text-blue-600',
    '对比': 'text-purple-600',
    '推翻': 'text-red-600',
    '应用': 'text-green-600',
  };
  return map[relation] || 'text-gray-600';
}

// 生成示例数据（人工智能三次浪潮）
export function generateSampleData(modelId: string, stages: string[], duration: Duration): PathInstance {
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
        logicRelation: '建立',
        activities: [
          {
            activityId: nanoid(),
            nodeId: '',
            activityType: '阅读理解',
            taskDescription: '阅读"人工智能三次浪潮"材料，在时间轴上标注每次浪潮的起止年份和代表技术。',
            toolRequired: '无',
            deliverableType: '图片',
            evaluationMode: '人工评价',
            evaluationRubric: '时间节点准确，技术特征描述完整',
            estimatedTime: 8,
          },
        ],
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
        logicRelation: '对比',
        activities: [
          {
            activityId: nanoid(),
            nodeId: '',
            activityType: '讨论表达',
            taskDescription: '小组讨论：从算力、数据规模、核心算法三个维度，填写三次浪潮对比表格。',
            toolRequired: '无',
            deliverableType: '文本',
            evaluationMode: '人工评价',
            evaluationRubric: '三个维度均有内容，对比逻辑清晰',
            estimatedTime: 8,
          },
        ],
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
        logicRelation: '建立',
        activities: [
          {
            activityId: nanoid(),
            nodeId: '',
            activityType: '讨论表达',
            taskDescription: '思考并写下：你认为第一次AI低谷的主要原因是什么？请列出至少两条理由。',
            toolRequired: '无',
            deliverableType: '文本',
            evaluationMode: '人工评价',
            evaluationRubric: '能识别技术和社会两个层面的原因',
            estimatedTime: 8,
          },
        ],
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
        logicRelation: '应用',
        activities: [
          {
            activityId: nanoid(),
            nodeId: '',
            activityType: '讨论表达',
            taskDescription: '班级共议：技术发展是否能独立于社会条件？结合三次浪潮案例说明。',
            toolRequired: '无',
            deliverableType: '文本',
            evaluationMode: '人工评价',
            evaluationRubric: '能结合具体案例论证观点',
            estimatedTime: 8,
          },
        ],
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
        logicRelation: '应用',
        activities: [
          {
            activityId: nanoid(),
            nodeId: '',
            activityType: '单项填空',
            taskDescription: '用一句话概括：技术发展周期的核心规律是什么？',
            toolRequired: '无',
            deliverableType: '文本',
            evaluationMode: '人工评价',
            evaluationRubric: '表述简洁，包含"期望-低谷-成熟"的周期概念',
            estimatedTime: 8,
          },
        ],
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

  // 修正 nodeId 引用
  stageInstances.forEach((stage) => {
    stage.nodes.forEach((node) => {
      node.activities.forEach((act) => {
        act.nodeId = node.nodeId;
      });
    });
  });

  return {
    modelId,
    duration,
    stages: stageInstances,
    status: '草稿',
  };
}

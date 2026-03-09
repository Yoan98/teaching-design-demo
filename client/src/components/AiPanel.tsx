// AiPanel — 右侧滑入式 AI 对话面板
// 设计哲学：
//   - 页面主内容区不被遮挡，面板与主内容并排
//   - 上下文感知：打开时自动绑定当前编辑区域
//   - 持续对话：对话历史分区域独立保存，关闭不丢失
//   - 变更直接应用到左侧表单，对话中显示变更摘要

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, ChevronDown, RotateCcw, Check, Loader2 } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { useAppStore, type Duration, type CourseType, type StudentGrade } from '@/lib/store';
import { nanoid } from 'nanoid';

// ─── 类型 ─────────────────────────────────────────────────────

export type AiContext =
  | 'context-block1'   // 知识核心
  | 'context-block2'   // 能力目标
  | 'context-block3'   // 课堂条件
  | 'path-node'        // 路径节点（带 nodeId）
  | 'activity'         // 活动展开（带 nodeId）

export interface AiPanelMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  appliedChanges?: string[];  // 已应用的变更摘要
  timestamp: number;
}

export interface AiPanelState {
  isOpen: boolean;
  activeContext: AiContext;
  activeNodeId?: string;   // path-node / activity 时使用
  // 每个 context 独立保存对话历史
  histories: Record<string, AiPanelMessage[]>;
}

// ─── 上下文标签配置 ────────────────────────────────────────────

const CONTEXT_LABELS: Record<AiContext, string> = {
  'context-block1': '知识核心',
  'context-block2': '能力目标',
  'context-block3': '课堂条件',
  'path-node': '认知节点',
  'activity': '学生活动',
};

const CONTEXT_HINTS: Record<AiContext, string[]> = {
  'context-block1': [
    '帮我优化核心问题，让它更有挑战性',
    '根据主题补充 2 个关键概念',
    '把教学主题改得更聚焦',
  ],
  'context-block2': [
    '把目标能力改写得更具体可测量',
    '补充一条核心素养',
    '让能力目标与核心问题更对齐',
  ],
  'context-block3': [
    '建议合适的课时长度',
    '这个主题适合哪种课程类型？',
    '根据主题推荐学段',
  ],
  'path-node': [
    '优化这个节点的学习目标',
    '建议更合适的节点类型',
    '调整时间分配',
  ],
  'activity': [
    '帮我设计一个具体的学生活动',
    '优化任务描述，让学生更清楚要做什么',
    '建议合适的评价方式',
  ],
};

// ─── 模拟 AI 回复逻辑 ──────────────────────────────────────────

function simulateAiReply(
  userMsg: string,
  context: AiContext,
  nodeId: string | undefined,
  store: ReturnType<typeof useAppStore.getState>,
  onChunk: (chunk: string) => void,
  onDone: (changes: string[]) => void
) {
  const { context: ctx, pathInstance, updateContext, updateNode, updateActivity } = store;

  // 根据上下文和用户意图生成回复 + 应用变更
  const replies: { text: string; changes: string[]; apply?: () => void }[] = [];

  const msg = userMsg.toLowerCase();

  if (context === 'context-block1') {
    if (msg.includes('核心问题') || msg.includes('问题')) {
      const newQ = '人工智能的每一次复苏背后，是什么社会条件与技术突破共同作用的结果？';
      replies.push({
        text: `好的，我把核心问题改写得更有探究深度：\n\n> **${newQ}**\n\n这个问题引导学生同时关注技术内因和社会外因，适合概念建构类课程的深层讨论。`,
        changes: ['核心问题已更新'],
        apply: () => updateContext({ coreQuestion: newQ }),
      });
    } else if (msg.includes('概念') || msg.includes('补充')) {
      replies.push({
        text: `根据「人工智能三次浪潮」主题，建议补充以下概念：\n\n- **符号主义**：第一次浪潮的核心范式\n- **连接主义**：神经网络的理论基础\n\n已添加到核心概念列表。`,
        changes: ['已添加「符号主义」「连接主义」两个概念'],
        apply: () => {
          const current = store.context.concepts;
          const toAdd = ['符号主义', '连接主义'].filter(c => !current.includes(c));
          if (toAdd.length > 0) updateContext({ concepts: [...current, ...toAdd] });
        },
      });
    } else if (msg.includes('主题') || msg.includes('聚焦')) {
      const newTopic = 'AI 三次浪潮：技术演进与社会驱动';
      replies.push({
        text: `原主题「人工智能三次浪潮」偏描述性，我建议改为：\n\n> **${newTopic}**\n\n加入「社会驱动」维度，与核心问题形成呼应，也更能体现课程的分析视角。`,
        changes: ['教学主题已更新'],
        apply: () => updateContext({ topic: newTopic }),
      });
    } else {
      replies.push({
        text: `收到。关于「知识核心」，我可以帮你：\n\n1. **优化核心问题** — 让问题更有探究张力\n2. **补充关键概念** — 根据主题推荐遗漏的概念\n3. **聚焦教学主题** — 让主题表述更精准\n\n请告诉我你想调整哪个方向？`,
        changes: [],
      });
    }
  } else if (context === 'context-block2') {
    if (msg.includes('能力') || msg.includes('目标') || msg.includes('具体')) {
      const newAbility = '能从算力、数据、算法三个维度分析 AI 浪潮的驱动因素，并能评估当前 AI 发展的可持续性风险';
      replies.push({
        text: `原目标能力较宽泛，我改写为更具体可测量的版本：\n\n> **${newAbility}**\n\n增加了「三个维度」的具体分析框架，并将「评价」行为动词改为「评估风险」，可测量性更强。`,
        changes: ['目标能力已更新为更具体可测量的表述'],
        apply: () => updateContext({ ability: newAbility }),
      });
    } else if (msg.includes('素养') || msg.includes('补充')) {
      replies.push({
        text: `建议补充一条核心素养：\n\n> **批判性思维** — 能质疑 AI 技术叙事，识别技术乐观主义的局限\n\n已添加到核心素养。`,
        changes: ['核心素养已补充「批判性思维」'],
        apply: () => {
          const current = ctx.competency;
          if (!current.includes('批判性思维')) {
            updateContext({ competency: current + ' · 批判性思维' });
          }
        },
      });
    } else {
      replies.push({
        text: `关于「能力目标」，我可以帮你：\n\n1. **改写目标能力** — 让行为动词更精准，增加可测量性\n2. **补充核心素养** — 根据课程类型推荐对应素养\n3. **对齐核心问题** — 确保能力目标与核心问题逻辑一致\n\n你想从哪里开始？`,
        changes: [],
      });
    }
  } else if (context === 'context-block3') {
    if (msg.includes('课时') || msg.includes('时间') || msg.includes('长度')) {
      replies.push({
        text: `「人工智能三次浪潮」是概念建构类课程，内容密度中等。建议：\n\n- **40 分钟**：适合高中常规课时，节奏紧凑但可完成核心环节\n- **60 分钟**：可增加小组讨论深度，更推荐\n\n当前已设置为 40 分钟，如需调整请告诉我。`,
        changes: [],
      });
    } else if (msg.includes('类型') || msg.includes('课程')) {
      replies.push({
        text: `根据核心问题「为什么 AI 会经历多次低谷与复苏」，这是典型的**概念建构**类课程 —— 学生需要从多个案例中归纳出规律性认知，而非解决一个具体问题。\n\n当前已设置为「概念建构」，设置正确。`,
        changes: [],
      });
    } else {
      replies.push({
        text: `关于「课堂条件」，我可以帮你：\n\n1. **建议课时长度** — 根据内容复杂度推荐\n2. **判断课程类型** — 概念建构 vs 自主探究\n3. **推荐适合学段** — 根据认知难度匹配\n\n你想了解哪个？`,
        changes: [],
      });
    }
  } else if (context === 'path-node' && nodeId) {
    const node = pathInstance.stages.flatMap(s => s.nodes).find(n => n.nodeId === nodeId);
    if (!node) {
      replies.push({ text: '找不到该节点，请重试。', changes: [] });
    } else if (msg.includes('目标') || msg.includes('优化') || msg.includes('改')) {
      const newGoal = node.learningGoal
        ? `能够${node.learningGoal.replace(/^能够/, '')}，并说明判断依据`
        : '能够分析该阶段的核心认知任务，并说明判断依据';
      replies.push({
        text: `原目标「${node.learningGoal}」偏描述性，我在末尾加上「并说明判断依据」，要求学生显性化推理过程：\n\n> **${newGoal}**\n\n这样在活动设计时更容易设计对应的证据收集方式。`,
        changes: [`节点「${node.nodeType}」学习目标已更新`],
        apply: () => updateNode(nodeId, { learningGoal: newGoal }),
      });
    } else if (msg.includes('时间') || msg.includes('分钟')) {
      replies.push({
        text: `当前节点时间为 ${node.estimatedTime} 分钟。根据节点类型「${node.nodeType}」，建议：\n\n- 如果是**个人思考类**：8-10 分钟\n- 如果是**小组讨论类**：10-15 分钟\n- 如果是**全班共议类**：5-8 分钟\n\n需要我帮你调整吗？`,
        changes: [],
      });
    } else {
      replies.push({
        text: `关于节点「${node.nodeType}」，我可以帮你：\n\n1. **优化学习目标** — 让目标更精准可评估\n2. **建议时间分配** — 根据活动类型推荐时长\n3. **调整节点类型** — 是否与当前阶段匹配\n\n你想调整哪里？`,
        changes: [],
      });
    }
  } else if (context === 'activity' && nodeId) {
    const node = pathInstance.stages.flatMap(s => s.nodes).find(n => n.nodeId === nodeId);
    if (!node) {
      replies.push({ text: '找不到该节点，请重试。', changes: [] });
    } else if (msg.includes('活动') || msg.includes('设计') || msg.includes('帮我')) {
      const actType = node.activities.length === 0 ? '讨论表达' : node.activities[0].activityType;
      const newDesc = `请在 ${node.estimatedTime} 分钟内，以小组为单位完成以下任务：结合本节课材料，${node.learningGoal || '完成指定认知任务'}。每组需产出一份简短的书面记录（3-5 句话），并准备在全班分享。`;
      if (node.activities.length > 0) {
        replies.push({
          text: `我为第一个活动重写了任务描述，更明确了时间、形式和产出要求：\n\n> ${newDesc}\n\n关键改进：加入了时间约束、小组形式说明和产出要求，学生知道要做什么、做多久、交什么。`,
          changes: ['第一个活动的任务描述已更新'],
          apply: () => {
            if (node.activities[0]) {
              updateActivity(node.activities[0].activityId, { taskDescription: newDesc });
            }
          },
        });
      } else {
        replies.push({
          text: `该节点还没有活动。建议添加一个「${actType}」类型的活动：\n\n> ${newDesc}\n\n请先在左侧点击「添加活动」，然后我可以帮你填写具体内容。`,
          changes: [],
        });
      }
    } else if (msg.includes('评价') || msg.includes('评估')) {
      if (node.activities.length > 0) {
        const act = node.activities[0];
        const newRubric = '能准确描述核心概念（2分）；逻辑推理有依据（2分）；表达清晰（1分）';
        replies.push({
          text: `为第一个活动设计了一个简单的评价量规（5分制）：\n\n> **${newRubric}**\n\n这个量规聚焦认知质量而非形式，适合快速课堂评价。已应用到活动中。`,
          changes: ['第一个活动的评价量规已更新'],
          apply: () => updateActivity(act.activityId, { evaluationRubric: newRubric }),
        });
      } else {
        replies.push({ text: '该节点还没有活动，请先添加活动后再设计评价方式。', changes: [] });
      }
    } else {
      replies.push({
        text: `关于「${node.nodeType}」节点的活动，我可以帮你：\n\n1. **设计具体活动** — 生成有时间约束和产出要求的任务描述\n2. **优化任务描述** — 让学生更清楚要做什么\n3. **设计评价量规** — 快速生成可操作的评价标准\n\n你想从哪里开始？`,
        changes: [],
      });
    }
  } else {
    replies.push({
      text: `我是你的教学设计助手。你可以告诉我想调整什么，我会直接帮你修改对应内容。`,
      changes: [],
    });
  }

  const reply = replies[0];

  // 模拟流式输出
  const chars = reply.text.split('');
  let i = 0;
  const interval = setInterval(() => {
    if (i < chars.length) {
      onChunk(chars.slice(0, i + 1).join(''));
      i += Math.floor(Math.random() * 4) + 2;
    } else {
      clearInterval(interval);
      if (reply.apply) reply.apply();
      onDone(reply.changes);
    }
  }, 30);
}

// ─── 消息气泡 ──────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: AiPanelMessage }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* 头像 */}
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles size={12} className="text-primary" />
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* 气泡 */}
        <div className={`
          rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
          ${isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted/60 text-foreground rounded-tl-sm'
          }
        `}>
          {isUser ? (
            <span>{msg.content}</span>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-blockquote:my-1 prose-blockquote:border-primary/40 prose-blockquote:text-foreground/80">
              <Streamdown>{msg.content}</Streamdown>
            </div>
          )}
        </div>

        {/* 已应用变更标签 */}
        {msg.appliedChanges && msg.appliedChanges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {msg.appliedChanges.map((change, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                <Check size={10} strokeWidth={2.5} />
                {change}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────

interface AiPanelProps {
  state: AiPanelState;
  onChange: (state: AiPanelState) => void;
}

export function AiPanel({ state, onChange }: AiPanelProps) {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const store = useAppStore();

  const contextKey = state.activeContext + (state.activeNodeId ? `-${state.activeNodeId}` : '');
  const messages = state.histories[contextKey] || [];
  const hints = CONTEXT_HINTS[state.activeContext] || [];

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // 面板打开时聚焦输入框
  useEffect(() => {
    if (state.isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [state.isOpen, state.activeContext]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    setInput('');

    const userMsg: AiPanelMessage = {
      id: nanoid(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    // 添加用户消息
    const newHistories = {
      ...state.histories,
      [contextKey]: [...messages, userMsg],
    };
    onChange({ ...state, histories: newHistories });

    // 开始流式回复
    setIsStreaming(true);
    setStreamingContent('');

    const storeState = useAppStore.getState();
    simulateAiReply(
      text.trim(),
      state.activeContext,
      state.activeNodeId,
      storeState,
      (chunk) => setStreamingContent(chunk),
      (changes) => {
        setIsStreaming(false);
        const aiMsg: AiPanelMessage = {
          id: nanoid(),
          role: 'assistant',
          content: streamingContentRef.current,
          appliedChanges: changes,
          timestamp: Date.now(),
        };
        setStreamingContent('');
        onChange({
          ...state,
          histories: {
            ...newHistories,
            [contextKey]: [...(newHistories[contextKey] || []), aiMsg],
          },
        });
      }
    );
  }, [state, onChange, messages, contextKey, isStreaming]);

  // 用 ref 捕获最新的 streamingContent（避免闭包问题）
  const streamingContentRef = useRef('');
  useEffect(() => {
    streamingContentRef.current = streamingContent;
  }, [streamingContent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearHistory = () => {
    onChange({
      ...state,
      histories: { ...state.histories, [contextKey]: [] },
    });
  };

  return (
    <AnimatePresence>
      {state.isOpen && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed right-0 top-0 bottom-0 w-[360px] bg-background border-l border-border flex flex-col z-40"
          style={{ boxShadow: '-4px 0 24px oklch(0.22 0.015 240 / 0.08)' }}
        >
          {/* 面板头部 */}
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border shrink-0">
            <div className="w-7 h-7 rounded-full bg-primary/12 flex items-center justify-center">
              <Sparkles size={14} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">AI 助手</p>
              <p className="text-sm font-medium text-foreground leading-tight truncate">
                {CONTEXT_LABELS[state.activeContext]}
                {state.activeNodeId && (
                  <span className="text-muted-foreground font-normal"> · 节点编辑</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearHistory}
                  title="清空对话"
                  className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <RotateCcw size={13} />
                </button>
              )}
              <button
                onClick={() => onChange({ ...state, isOpen: false })}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* 对话区域 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {messages.length === 0 && !isStreaming ? (
              /* 空状态：快捷提示 */
              <div className="flex flex-col items-center justify-center h-full text-center pb-8">
                <div className="w-12 h-12 rounded-full bg-primary/8 flex items-center justify-center mb-3">
                  <Sparkles size={20} className="text-primary/60" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  正在编辑「{CONTEXT_LABELS[state.activeContext]}」
                </p>
                <p className="text-xs text-muted-foreground mb-5 max-w-[220px] leading-relaxed">
                  告诉我你想怎么调整，我会直接修改左侧内容
                </p>
                {/* 快捷提示按钮 */}
                <div className="flex flex-col gap-2 w-full">
                  {hints.map((hint, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(hint)}
                      className="text-left text-xs text-foreground/80 bg-muted/50 hover:bg-muted px-3.5 py-2.5 rounded-xl border border-border/60 hover:border-border transition-all leading-relaxed"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}

                {/* 流式输出中 */}
                {isStreaming && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2.5"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles size={12} className="text-primary animate-pulse" />
                    </div>
                    <div className="max-w-[85%] bg-muted/60 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                      {streamingContent ? (
                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-blockquote:my-1 prose-blockquote:border-primary/40 prose-blockquote:text-foreground/80 text-sm leading-relaxed">
                          <Streamdown>{streamingContent}</Streamdown>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 py-0.5">
                          <Loader2 size={12} className="animate-spin text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">思考中…</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* 输入区域 */}
          <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
            {/* 快捷提示（有历史时显示在输入框上方） */}
            {messages.length > 0 && hints.length > 0 && (
              <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-none">
                {hints.map((hint, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(hint)}
                    disabled={isStreaming}
                    className="text-xs text-muted-foreground bg-muted/50 hover:bg-muted px-2.5 py-1.5 rounded-lg border border-border/60 whitespace-nowrap transition-all disabled:opacity-40"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="告诉我想怎么调整…"
                disabled={isStreaming}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all disabled:opacity-50 min-h-[40px] max-h-[120px]"
                style={{ lineHeight: '1.5' }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 disabled:opacity-30"
                style={{ background: input.trim() && !isStreaming ? 'oklch(0.42 0.09 240)' : undefined }}
              >
                <Send size={15} className={input.trim() && !isStreaming ? 'text-white' : 'text-muted-foreground'} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground/50 mt-1.5 text-center">
              Enter 发送 · Shift+Enter 换行
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── 触发按钮 ──────────────────────────────────────────────────

interface AiTriggerProps {
  context: AiContext;
  nodeId?: string;
  panelState: AiPanelState;
  onOpen: (context: AiContext, nodeId?: string) => void;
  size?: 'sm' | 'md';
}

export function AiTrigger({ context, nodeId, panelState, onOpen, size = 'md' }: AiTriggerProps) {
  const contextKey = context + (nodeId ? `-${nodeId}` : '');
  const hasHistory = (panelState.histories[contextKey] || []).length > 0;
  const isActive = panelState.isOpen && panelState.activeContext === context &&
    panelState.activeNodeId === nodeId;

  return (
    <button
      onClick={() => onOpen(context, nodeId)}
      title="AI 辅助编辑"
      className={`
        flex items-center gap-1.5 rounded-lg transition-all duration-150 font-medium
        ${size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs'}
        ${isActive
          ? 'bg-primary/15 text-primary border border-primary/30'
          : hasHistory
            ? 'bg-primary/8 text-primary/80 border border-primary/20 hover:bg-primary/15'
            : 'bg-muted/60 text-muted-foreground border border-border/60 hover:bg-muted hover:text-foreground'
        }
      `}
    >
      <Sparkles size={size === 'sm' ? 11 : 12} className={isActive ? 'text-primary' : ''} />
      <span>AI</span>
      {hasHistory && !isActive && (
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
      )}
    </button>
  );
}

// ─── 全局状态初始值 ────────────────────────────────────────────

export const defaultAiPanelState: AiPanelState = {
  isOpen: false,
  activeContext: 'context-block1',
  activeNodeId: undefined,
  histories: {},
};

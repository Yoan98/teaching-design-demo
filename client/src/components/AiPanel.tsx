// AiPanel — 右侧滑入式 AI 对话面板

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, RotateCcw, Check, Loader2 } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { nanoid } from 'nanoid';
import { useAppStore, type Activity } from '@/lib/store';
import {
  parseUpdatePayloadFromReply,
  streamAIPanelByLLM,
} from '@/lib/ai-service';
import {
  useAIConfigStore,
  type AiPanelStoredMessage,
} from '@/lib/ai-store';
import { toast } from 'sonner';

// ─── 类型 ─────────────────────────────────────────────────────

export type AiContext =
  | 'context-block1'
  | 'context-block2'
  | 'context-block3'
  | 'path-node'
  | 'activity';

export interface AiPanelMessage extends AiPanelStoredMessage {}

export interface AiPanelState {
  isOpen: boolean;
  activeContext: AiContext;
  activeNodeId?: string;
  histories: Record<string, AiPanelMessage[]>;
}

// ─── 上下文标签配置 ────────────────────────────────────────────

const CONTEXT_LABELS: Record<AiContext, string> = {
  'context-block1': '知识核心',
  'context-block2': '能力目标',
  'context-block3': '课堂条件',
  'path-node': '认知节点',
  activity: '学生活动',
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
    '建议合适的课时长度与课程类型',
    '根据主题推荐学段和学生水平',
    '按当前条件优化执行约束',
  ],
  'path-node': [
    '优化这个节点的学习目标',
    '建议更合适的节点类型和逻辑关系',
    '调整节点时间分配',
  ],
  activity: [
    '帮我设计 1 个具体活动',
    '优化任务描述，让学生更清楚要做什么',
    '生成可执行的评价量规',
  ],
};

function removeJsonCodeBlock(text: string): string {
  return text.replace(/```json[\s\S]*?```/gi, '').trim();
}

function buildContextSnapshot(context: AiContext, nodeId: string | undefined) {
  const store = useAppStore.getState();
  const node = nodeId
    ? store.pathInstance.stages.flatMap((s) => s.nodes).find((n) => n.nodeId === nodeId)
    : null;

  if (context === 'context-block1') {
    return {
      section: 'context-block1',
      context: {
        topic: store.context.topic,
        coreQuestion: store.context.coreQuestion,
        concepts: store.context.concepts,
      },
    };
  }

  if (context === 'context-block2') {
    return {
      section: 'context-block2',
      context: {
        ability: store.context.ability,
        competency: store.context.competency,
      },
    };
  }

  if (context === 'context-block3') {
    return {
      section: 'context-block3',
      context: {
        duration: store.context.duration,
        courseType: store.context.courseType,
        studentGrade: store.context.studentGrade,
        studentLevel: store.context.studentLevel,
        executionConstraints: store.context.executionConstraints,
      },
    };
  }

  if (context === 'path-node') {
    return {
      section: 'path-node',
      node,
      courseContext: store.context,
      model: store.selectedModel,
    };
  }

  return {
    section: 'activity',
    node,
    courseContext: store.context,
    model: store.selectedModel,
  };
}

function convertUpdatesToPartialActivity(update: Record<string, unknown>, nodeId: string): Partial<Activity> {
  return {
    nodeId,
    templateId: typeof update.templateId === 'string' ? update.templateId : null,
    activityType: typeof update.activityType === 'string' ? update.activityType : undefined,
    taskDescription: typeof update.taskDescription === 'string' ? update.taskDescription : undefined,
    toolRequired: typeof update.toolRequired === 'string' ? update.toolRequired : undefined,
    deliverableType: typeof update.deliverableType === 'string' ? update.deliverableType : undefined,
    evaluationMode: typeof update.evaluationMode === 'string' ? update.evaluationMode : undefined,
    evaluationRubric: typeof update.evaluationRubric === 'string' ? update.evaluationRubric : undefined,
    estimatedTime:
      typeof update.estimatedTime === 'number'
        ? update.estimatedTime
        : undefined,
  };
}

function applyUpdates(
  activeContext: AiContext,
  activeNodeId: string | undefined,
  updates: Record<string, unknown>
): string[] {
  const store = useAppStore.getState();
  const changes: string[] = [];

  if (activeContext.startsWith('context-block')) {
    const allowedFields = new Set([
      'topic',
      'coreQuestion',
      'concepts',
      'ability',
      'competency',
      'duration',
      'courseType',
      'studentGrade',
      'studentLevel',
      'studentProfileId',
    ]);

    const partial: Record<string, unknown> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (!allowedFields.has(key)) return;
      partial[key] = value;
      changes.push(`${key} 已更新`);
    });

    if (Object.keys(partial).length > 0) {
      store.updateContext(partial);
    }

    if (updates.executionConstraints && typeof updates.executionConstraints === 'object') {
      store.updateExecutionConstraints(updates.executionConstraints as Record<string, unknown>);
      changes.push('executionConstraints 已更新');
    }

    return changes;
  }

  if (activeContext === 'path-node' && activeNodeId) {
    const nodePartial: Record<string, unknown> = {};
    [
      'nodeType',
      'learningGoal',
      'studentBehavior',
      'evidenceType',
      'teacherSupportBehavior',
      'estimatedTime',
      'logicRelation',
    ].forEach((key) => {
      if (key in updates) {
        nodePartial[key] = updates[key];
        changes.push(`${key} 已更新`);
      }
    });

    if (Object.keys(nodePartial).length > 0) {
      store.updateNode(activeNodeId, nodePartial);
    }
    return changes;
  }

  if (activeContext === 'activity' && activeNodeId) {
    const node = store.pathInstance.stages
      .flatMap((stage) => stage.nodes)
      .find((item) => item.nodeId === activeNodeId);

    if (!node) return changes;

    if (Array.isArray(updates.activities)) {
      const generated = updates.activities
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const partial = convertUpdatesToPartialActivity(item as Record<string, unknown>, activeNodeId);
          return {
            activityId: nanoid(),
            nodeId: activeNodeId,
            templateId: partial.templateId ?? null,
            activityType: partial.activityType || '讨论表达',
            taskDescription: partial.taskDescription || '',
            toolRequired: partial.toolRequired || '无',
            deliverableType: partial.deliverableType || '文本',
            evaluationMode: partial.evaluationMode || '人工评价',
            evaluationRubric: partial.evaluationRubric || '',
            estimatedTime: partial.estimatedTime || 5,
            behaviorSequence: [],
          } as Activity;
        });

      store.setNodeActivities(activeNodeId, [...node.activities, ...generated]);
      changes.push(`已新增 ${generated.length} 个活动`);
      return changes;
    }

    if (node.activities.length > 0) {
      const first = node.activities[0];
      store.updateActivity(first.activityId, convertUpdatesToPartialActivity(updates, activeNodeId));
      changes.push('首个活动已更新');
    }

    return changes;
  }

  return changes;
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
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles size={12} className="text-primary" />
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`
          rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
          ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted/60 text-foreground rounded-tl-sm'
          }
        `}
        >
          {isUser ? (
            <span>{msg.content}</span>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-blockquote:my-1 prose-blockquote:border-primary/40 prose-blockquote:text-foreground/80">
              <Streamdown>{msg.content}</Streamdown>
            </div>
          )}
        </div>

        {msg.appliedChanges && msg.appliedChanges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {msg.appliedChanges.map((change, i) => (
              <span
                key={i}
                className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60"
              >
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

  const histories = useAIConfigStore((s) => s.aiPanelHistories);
  const setAiPanelHistory = useAIConfigStore((s) => s.setAiPanelHistory);
  const clearAiPanelHistory = useAIConfigStore((s) => s.clearAiPanelHistory);

  const contextKey = state.activeContext + (state.activeNodeId ? `-${state.activeNodeId}` : '');
  const messages = histories[contextKey] || [];
  const hints = CONTEXT_HINTS[state.activeContext] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (state.isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [state.isOpen, state.activeContext]);

  const historyForModel = useMemo<LLMMessage[]>(() => {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;
      setInput('');

      const userMsg: AiPanelMessage = {
        id: nanoid(),
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };

      const newHistory = [...messages, userMsg];
      setAiPanelHistory(contextKey, newHistory);

      setIsStreaming(true);
      setStreamingContent('');

      try {
        const reply = await streamAIPanelByLLM({
          history: historyForModel,
          contextSnapshot: buildContextSnapshot(state.activeContext, state.activeNodeId),
          userInput: text.trim(),
          onToken: (token) => {
            setStreamingContent((prev) => prev + token);
          },
        });

        const updates = parseUpdatePayloadFromReply(reply);
        const appliedChanges = updates
          ? applyUpdates(state.activeContext, state.activeNodeId, updates)
          : [];

        const aiMsg: AiPanelMessage = {
          id: nanoid(),
          role: 'assistant',
          content: removeJsonCodeBlock(reply),
          appliedChanges,
          timestamp: Date.now(),
        };

        setAiPanelHistory(contextKey, [...newHistory, aiMsg]);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'AI 调用失败';
        toast.error(msg);
        const failMsg: AiPanelMessage = {
          id: nanoid(),
          role: 'assistant',
          content: `AI 调用失败：${msg}`,
          timestamp: Date.now(),
        };
        setAiPanelHistory(contextKey, [...newHistory, failMsg]);
      } finally {
        setIsStreaming(false);
        setStreamingContent('');
      }
    },
    [
      contextKey,
      historyForModel,
      isStreaming,
      messages,
      setAiPanelHistory,
      state.activeContext,
      state.activeNodeId,
    ]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
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
                  onClick={() => clearAiPanelHistory(contextKey)}
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

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {messages.length === 0 && !isStreaming ? (
              <div className="flex flex-col items-center justify-center h-full text-center pb-8">
                <div className="w-12 h-12 rounded-full bg-primary/8 flex items-center justify-center mb-3">
                  <Sparkles size={20} className="text-primary/60" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  正在编辑「{CONTEXT_LABELS[state.activeContext]}」
                </p>
                <p className="text-xs text-muted-foreground mb-5 max-w-[220px] leading-relaxed">
                  告诉我你想怎么调整，我会尝试直接修改左侧内容
                </p>
                <div className="flex flex-col gap-2 w-full">
                  {hints.map((hint, i) => (
                    <button
                      key={i}
                      onClick={() => void sendMessage(hint)}
                      className="text-left text-xs text-foreground/80 bg-muted/50 hover:bg-muted px-3.5 py-2.5 rounded-xl border border-border/60 hover:border-border transition-all leading-relaxed"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}

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
                        <div className="prose prose-sm max-w-none text-sm leading-relaxed">
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

          <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
            {messages.length > 0 && hints.length > 0 && (
              <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-none">
                {hints.map((hint, i) => (
                  <button
                    key={i}
                    onClick={() => void sendMessage(hint)}
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
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="告诉我想怎么调整…"
                disabled={isStreaming}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all disabled:opacity-50 min-h-[40px] max-h-[120px]"
                style={{ lineHeight: '1.5' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
              />
              <button
                onClick={() => void sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 disabled:opacity-30"
                style={{
                  background: input.trim() && !isStreaming ? 'oklch(0.42 0.09 240)' : undefined,
                }}
              >
                <Send
                  size={15}
                  className={input.trim() && !isStreaming ? 'text-white' : 'text-muted-foreground'}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground/50 mt-1.5 text-center">Enter 发送 · Shift+Enter 换行</p>
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
  const histories = useAIConfigStore((s) => s.aiPanelHistories);
  const contextKey = context + (nodeId ? `-${nodeId}` : '');
  const hasHistory = (histories[contextKey] || []).length > 0;
  const isActive =
    panelState.isOpen && panelState.activeContext === context && panelState.activeNodeId === nodeId;

  return (
    <button
      onClick={() => onOpen(context, nodeId)}
      title="AI 辅助编辑"
      className={`
        flex items-center gap-1.5 rounded-lg transition-all duration-150 font-medium
        ${size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs'}
        ${
          isActive
            ? 'bg-primary/15 text-primary border border-primary/30'
            : hasHistory
              ? 'bg-primary/8 text-primary/80 border border-primary/20 hover:bg-primary/15'
              : 'bg-muted/60 text-muted-foreground border border-border/60 hover:bg-muted hover:text-foreground'
        }
      `}
    >
      <Sparkles size={size === 'sm' ? 11 : 12} className={isActive ? 'text-primary' : ''} />
      <span>AI</span>
      {hasHistory && !isActive && <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />}
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

type LLMMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

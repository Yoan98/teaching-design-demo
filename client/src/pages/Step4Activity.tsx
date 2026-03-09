// Step 4: 活动展开
// 设计哲学：节点手风琴展开，活动卡片内联编辑，时间超出醒目提示
// 验证点：老师是否频繁新增活动而不修改节点（说明节点抽象过高）

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, Plus, Trash2, Copy,
  Clock, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAiPanel } from '@/App';
import { AiTrigger } from '@/components/AiPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import {
  useAppStore, getNodeTypeColor, getNodeTotalActivityTime,
  type Node, type Activity
} from '@/lib/store';

const ACTIVITY_TYPES = [
  '操作实验', '讨论表达', '阅读理解', '参数测试',
  '单项选择', '单项填空', '多项填空', '观察记录', '小组协作'
];

const TOOL_OPTIONS = [
  '无', 'AI 绘图', 'Python 编辑器', '手势模型训练', '实验中心', '在线文档', '白板工具'
];

const DELIVERABLE_TYPES = ['代码', '图片', '网址', '文本', '选择结果', '音频', '视频'];
const EVALUATION_MODES = ['自动检测', '规则检测', '人工评价', '同伴互评'];

// 活动卡片
function ActivityCard({ activity }: { activity: Activity }) {
  const { updateActivity, deleteActivity } = useAppStore();
  const { panelState, openPanel } = useAiPanel();

  const handleCopy = () => {
    const newAct: Activity = {
      ...activity,
      activityId: nanoid(),
      taskDescription: activity.taskDescription + '（副本）',
    };
    const stages = useAppStore.getState().pathInstance.stages.map(stage => ({
      ...stage,
      nodes: stage.nodes.map(node => {
        if (node.nodeId !== activity.nodeId) return node;
        const idx = node.activities.findIndex(a => a.activityId === activity.activityId);
        const acts = [...node.activities];
        acts.splice(idx + 1, 0, newAct);
        return { ...node, activities: acts };
      })
    }));
    useAppStore.setState(s => ({ pathInstance: { ...s.pathInstance, stages } }));
    toast.success('已复制活动');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="bg-white border border-border/70 rounded-xl p-4"
      style={{ boxShadow: '0 1px 3px oklch(0.22 0.015 240 / 0.05)' }}
    >
      {/* 顶部：活动类型 + 时间 + 操作 */}
      <div className="flex items-center gap-2 mb-3">
        <Select
          value={activity.activityType}
          onValueChange={(v) => updateActivity(activity.activityId, { activityType: v })}
        >
          <SelectTrigger className="h-7 text-xs w-32 border-border/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPES.map(t => (
              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 ml-auto">
          <Clock size={11} className="text-muted-foreground/60" />
          <input
            type="number"
            value={activity.estimatedTime}
            onChange={(e) => updateActivity(activity.activityId, { estimatedTime: parseInt(e.target.value) || 0 })}
            className="w-10 h-6 text-xs text-center border border-border/60 rounded-md bg-white"
            min={1} max={60}
          />
          <span className="text-xs text-muted-foreground">分</span>
        </div>

        <div className="flex items-center gap-1">
          {/* AI 辅助按钮 */}
          <AiTrigger
            context="activity"
            nodeId={activity.nodeId}
            panelState={panelState}
            onOpen={openPanel}
            size="sm"
          />
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
          >
            <Copy size={12} />
          </button>
          <button
            onClick={() => deleteActivity(activity.activityId)}
            className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* 任务描述 */}
      <Textarea
        value={activity.taskDescription}
        onChange={(e) => updateActivity(activity.activityId, { taskDescription: e.target.value })}
        placeholder="具体任务描述，例：阅读材料后在时间轴上标注每次浪潮的起止年份..."
        className="text-sm min-h-[56px] resize-none mb-3 bg-white/80 border-border/60"
      />

      {/* 工具 + 提交类型 + 评价方式 */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <label className="text-xs text-muted-foreground/70 mb-1 block">工具</label>
          <Select
            value={activity.toolRequired}
            onValueChange={(v) => updateActivity(activity.activityId, { toolRequired: v })}
          >
            <SelectTrigger className="h-7 text-xs border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOOL_OPTIONS.map(t => (
                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground/70 mb-1 block">提交类型</label>
          <Select
            value={activity.deliverableType}
            onValueChange={(v) => updateActivity(activity.activityId, { deliverableType: v })}
          >
            <SelectTrigger className="h-7 text-xs border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELIVERABLE_TYPES.map(t => (
                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground/70 mb-1 block">评价方式</label>
          <Select
            value={activity.evaluationMode}
            onValueChange={(v) => updateActivity(activity.activityId, { evaluationMode: v })}
          >
            <SelectTrigger className="h-7 text-xs border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVALUATION_MODES.map(t => (
                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Input
        value={activity.evaluationRubric}
        onChange={(e) => updateActivity(activity.activityId, { evaluationRubric: e.target.value })}
        placeholder="评价标准（可选）..."
        className="text-xs h-7 bg-white/80 border-border/60"
      />
    </motion.div>
  );
}

// 节点展开区域
function NodeSection({ node, stageLabel }: { node: Node; stageLabel?: string }) {
  const { toggleNodeExpanded, addActivity } = useAppStore();
  const { panelState, openPanel } = useAiPanel();
  const activityTime = getNodeTotalActivityTime(node);
  const isOver = activityTime > node.estimatedTime;
  const overBy = activityTime - node.estimatedTime;
  const isEmpty = node.activities.length === 0;

  return (
    <div className={`
      rounded-xl border overflow-hidden transition-all duration-200
      ${isOver ? 'border-red-200' : isEmpty ? 'border-amber-200/60' : 'border-border/70'}
    `}
    style={{ boxShadow: '0 1px 3px oklch(0.22 0.015 240 / 0.04)' }}
    >
      {/* 节点信息栏 — 用 div+role 避免嵌套 button（AiTrigger 内部是 button） */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => toggleNodeExpanded(node.nodeId)}
        onKeyDown={(e) => e.key === 'Enter' && toggleNodeExpanded(node.nodeId)}
        className={`
          w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer
          ${node.expanded ? 'bg-primary/4 border-b border-border/50' : 'bg-white hover:bg-muted/30'}
        `}
        style={node.expanded ? { background: 'oklch(0.42 0.09 240 / 0.04)' } : {}}
      >
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 ${getNodeTypeColor(node.nodeType)}`}>
          {node.nodeType}
        </span>
        <span className="text-sm font-medium text-foreground flex-1 truncate text-left">
          {node.learningGoal || '（未填写学习目标）'}
        </span>
        <div className="flex items-center gap-2.5 shrink-0">
          {isOver && (
            <div className="flex items-center gap-1 text-red-500">
              <AlertTriangle size={12} />
              <span className="text-xs font-medium">超 {overBy} 分</span>
            </div>
          )}
          {isEmpty && !node.expanded && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">待添加活动</span>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            节点 {node.estimatedTime} 分 · 活动 {activityTime} 分
          </span>
          {/* AI 辅助按钮：阻止事件冒泡避免触发手风琴展开 */}
          <span onClick={e => e.stopPropagation()}>
            <AiTrigger
              context="activity"
              nodeId={node.nodeId}
              panelState={panelState}
              onOpen={openPanel}
              size="sm"
            />
          </span>
          {node.expanded
            ? <ChevronUp size={14} className="text-muted-foreground/60" />
            : <ChevronDown size={14} className="text-muted-foreground/60" />
          }
        </div>
      </div>

      {/* 活动展开区 */}
      <AnimatePresence>
        {node.expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3 bg-muted/20">
              {/* 超时警告 */}
              {isOver && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} className="text-red-500 shrink-0" />
                  <span className="text-xs text-red-600 font-medium">
                    活动总时长超出节点时间 {overBy} 分钟，请调整时间分配。
                  </span>
                </div>
              )}

              {/* 活动卡片 */}
              <AnimatePresence mode="popLayout">
                {node.activities.map((activity) => (
                  <ActivityCard key={activity.activityId} activity={activity} />
                ))}
              </AnimatePresence>

              {/* 新增活动 */}
              <button
                onClick={() => addActivity(node.nodeId)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-border/50 rounded-xl text-xs text-muted-foreground/60 hover:border-primary/30 hover:text-primary/70 transition-all duration-200 bg-white/50"
              >
                <Plus size={13} />
                新增活动
              </button>

              {/* 时间小计 */}
              <div className="flex items-center justify-between text-xs text-muted-foreground/70 pt-1">
                <span>节点时间：{node.estimatedTime} 分钟</span>
                <span className={isOver ? 'text-red-500 font-medium' : ''}>
                  活动已用：{activityTime} 分钟
                  {isOver && ` · 超出 ${overBy} 分钟`}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Step4Activity() {
  const { pathInstance, setStep } = useAppStore();
  const allNodes = pathInstance.stages.flatMap(s => s.nodes);
  const hasOvertime = allNodes.some(n => getNodeTotalActivityTime(n) > n.estimatedTime);
  const emptyNodes = allNodes.filter(n => n.activities.length === 0);

  const handleNext = () => {
    if (emptyNodes.length > 0) {
      toast.error(`有 ${emptyNodes.length} 个节点尚无活动，请至少添加一个`);
      return;
    }
    if (hasOvertime) {
      toast.error('有节点活动时间超出，请调整后继续');
      return;
    }
    setStep(5);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-semibold text-foreground mb-1.5">活动展开</h1>
          <p className="text-sm text-muted-foreground">
            点击节点展开活动编辑区，为每个节点配置具体的学生活动。
          </p>

          {/* 状态提示 */}
          {(hasOvertime || emptyNodes.length > 0) && (
            <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200/80 rounded-xl px-3.5 py-2.5">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              <span className="text-xs text-amber-700">
                {emptyNodes.length > 0 && `${emptyNodes.length} 个节点尚无活动`}
                {emptyNodes.length > 0 && hasOvertime && '；'}
                {hasOvertime && '部分节点活动时间超出'}
                ，请处理后再进入预览。
              </span>
            </div>
          )}
        </div>

        {/* 按阶段分组 */}
        <div className="space-y-7">
          {pathInstance.stages.map((stage, idx) => (
            <div key={stage.stageId}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
                  阶段 {idx + 1}
                </span>
                <span className="text-sm font-medium text-foreground">{stage.stageType}</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <div className="space-y-2.5">
                {stage.nodes.map((node) => (
                  <NodeSection key={node.nodeId} node={node} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 底部操作 */}
        <div className="mt-10 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(3)}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={16} />
            返回
          </Button>
          <Button
            onClick={handleNext}
            className="gap-2 px-6"
            style={{ background: 'oklch(0.42 0.09 240)' }}
          >
            进入预览
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

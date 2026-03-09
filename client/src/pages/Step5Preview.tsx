// Step 5: 整体预览与发布
// 设计哲学：认知路径视图 + 教学活动表格视图，发布前强校验
// 验证点：结构是否可读、可执行

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft, CheckCircle2, AlertTriangle, Send,
  LayoutList, GitBranch, Clock, RotateCcw, BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useAppStore, getTotalTime, getNodeTypeColor, getNodeTotalActivityTime,
  getLogicRelationColor
} from '@/lib/store';

// 阶段颜色
const STAGE_COLORS = [
  { bar: 'bg-sky-400', dot: 'bg-sky-500', text: 'text-sky-700', bg: 'bg-sky-50' },
  { bar: 'bg-indigo-400', dot: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50' },
  { bar: 'bg-violet-400', dot: 'bg-violet-500', text: 'text-violet-700', bg: 'bg-violet-50' },
  { bar: 'bg-purple-400', dot: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50' },
  { bar: 'bg-fuchsia-400', dot: 'bg-fuchsia-500', text: 'text-fuchsia-700', bg: 'bg-fuchsia-50' },
  { bar: 'bg-pink-400', dot: 'bg-pink-500', text: 'text-pink-700', bg: 'bg-pink-50' },
];

// 认知路径视图
function CognitivePath() {
  const { pathInstance, context } = useAppStore();
  const totalTime = context.duration || 40;
  const usedTime = getTotalTime(pathInstance);

  return (
    <div className="space-y-4">
      {/* 时间分布条 */}
      <div className="bg-white border border-border/70 rounded-xl p-4"
        style={{ boxShadow: '0 1px 3px oklch(0.22 0.015 240 / 0.05)' }}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">时间分布</span>
          <span className="text-xs text-muted-foreground tabular-nums">{usedTime} / {totalTime} 分钟</span>
        </div>
        <div className="flex h-5 rounded-full overflow-hidden gap-0.5">
          {pathInstance.stages.map((stage, idx) => {
            const stageTime = stage.nodes.reduce((t, n) => t + n.estimatedTime, 0);
            const pct = totalTime > 0 ? (stageTime / totalTime) * 100 : 0;
            const color = STAGE_COLORS[idx % STAGE_COLORS.length];
            return (
              <div
                key={stage.stageId}
                className={`${color.bar} transition-all`}
                style={{ width: `${pct}%`, minWidth: pct > 0 ? '2px' : '0' }}
                title={`${stage.stageType}: ${stageTime} 分钟`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-2.5">
          {pathInstance.stages.map((stage, idx) => {
            const stageTime = stage.nodes.reduce((t, n) => t + n.estimatedTime, 0);
            const color = STAGE_COLORS[idx % STAGE_COLORS.length];
            return (
              <div key={stage.stageId} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-sm ${color.bar}`} />
                <span className="text-xs text-muted-foreground">{stage.stageType}（{stageTime} 分）</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 阶段-节点结构 */}
      {pathInstance.stages.map((stage, stageIdx) => {
        const color = STAGE_COLORS[stageIdx % STAGE_COLORS.length];
        return (
          <div key={stage.stageId} className="bg-white border border-border/70 rounded-xl overflow-hidden"
            style={{ boxShadow: '0 1px 3px oklch(0.22 0.015 240 / 0.05)' }}
          >
            {/* 阶段头 */}
            <div className={`flex items-center gap-2.5 px-4 py-3 ${color.bg} border-b border-border/50`}>
              <span className={`w-5 h-5 rounded-full ${color.dot} text-white text-xs flex items-center justify-center font-semibold`}>
                {stageIdx + 1}
              </span>
              <span className={`font-serif font-semibold text-sm ${color.text}`}>{stage.stageType}</span>
              <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                <Clock size={11} />
                {stage.nodes.reduce((t, n) => t + n.estimatedTime, 0)} 分钟
              </span>
            </div>

            {/* 节点列表 */}
            <div className="p-4 space-y-3">
              {stage.nodes.map((node, nodeIdx) => (
                <div key={node.nodeId} className="flex items-start gap-3">
                  <div className="flex flex-col items-center shrink-0 pt-1">
                    <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                      nodeIdx === 0 ? `${color.dot} border-transparent` : 'border-muted-foreground/40 bg-white'
                    }`} />
                    {nodeIdx < stage.nodes.length - 1 && (
                      <div className="w-px h-8 bg-border/50 mt-1" />
                    )}
                  </div>

                  <div className="flex-1 pb-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getNodeTypeColor(node.nodeType)}`}>
                        {node.nodeType}
                      </span>
                      {nodeIdx > 0 && (
                        <span className={`text-xs ${getLogicRelationColor(node.logicRelation)}`}>
                          ↑ {node.logicRelation}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground/60 ml-auto flex items-center gap-1">
                        <Clock size={10} /> {node.estimatedTime} 分
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-snug mb-1.5">{node.learningGoal}</p>
                    {node.activities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {node.activities.map(act => (
                          <span key={act.activityId}
                            className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full"
                          >
                            {act.activityType} · {act.estimatedTime} 分
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 教学活动表格视图
function ActivityTable() {
  const { pathInstance } = useAppStore();

  const rows: {
    stage: string;
    stageIdx: number;
    teacherBehavior: string;
    studentActivity: string;
    duration: number;
    learningGoal: string;
    isFirstInNode: boolean;
  }[] = [];

  pathInstance.stages.forEach((stage, stageIdx) => {
    stage.nodes.forEach(node => {
      if (node.activities.length === 0) {
        rows.push({
          stage: stage.stageType,
          stageIdx,
          teacherBehavior: node.teacherSupportBehavior || '—',
          studentActivity: '（暂无活动）',
          duration: node.estimatedTime,
          learningGoal: node.learningGoal,
          isFirstInNode: true,
        });
      } else {
        node.activities.forEach((act, idx) => {
          rows.push({
            stage: idx === 0 ? stage.stageType : '',
            stageIdx,
            teacherBehavior: idx === 0 ? (node.teacherSupportBehavior || '—') : '',
            studentActivity: act.taskDescription || '（未填写任务）',
            duration: act.estimatedTime,
            learningGoal: idx === 0 ? node.learningGoal : '',
            isFirstInNode: idx === 0,
          });
        });
      }
    });
  });

  return (
    <div className="bg-white border border-border/70 rounded-xl overflow-hidden"
      style={{ boxShadow: '0 1px 3px oklch(0.22 0.015 240 / 0.05)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border/60">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground/70 whitespace-nowrap uppercase tracking-wide">教学环节</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground/70 whitespace-nowrap uppercase tracking-wide">教师活动</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide">学生活动</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground/70 whitespace-nowrap uppercase tracking-wide">时长</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide">设计意图</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const color = STAGE_COLORS[row.stageIdx % STAGE_COLORS.length];
              return (
                <tr
                  key={idx}
                  className={`border-b border-border/40 transition-colors hover:bg-muted/20 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-muted/10'
                  }`}
                >
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    {row.stage && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
                        {row.stage}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground align-top max-w-[140px]">
                    {row.teacherBehavior}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground align-top max-w-[240px]">
                    {row.studentActivity}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground align-top whitespace-nowrap tabular-nums">
                    {row.duration} 分钟
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground align-top max-w-[200px]">
                    {row.learningGoal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 校验
function useValidation() {
  const { pathInstance, context } = useAppStore();
  const totalTime = context.duration || 40;
  const usedTime = getTotalTime(pathInstance);
  const allNodes = pathInstance.stages.flatMap(s => s.nodes);

  const errors: string[] = [];
  if (Math.abs(usedTime - totalTime) > 5) {
    errors.push(`总时长不匹配：计划 ${totalTime} 分钟，已分配 ${usedTime} 分钟`);
  }
  const emptyNodes = allNodes.filter(n => n.activities.length === 0);
  if (emptyNodes.length > 0) errors.push(`${emptyNodes.length} 个节点没有活动`);
  const overtimeNodes = allNodes.filter(n => getNodeTotalActivityTime(n) > n.estimatedTime);
  if (overtimeNodes.length > 0) errors.push(`${overtimeNodes.length} 个节点活动时间超出`);
  const emptyGoals = allNodes.filter(n => !n.learningGoal.trim());
  if (emptyGoals.length > 0) errors.push(`${emptyGoals.length} 个节点未填写学习目标`);

  return errors;
}

export default function Step5Preview() {
  const [view, setView] = useState<'path' | 'table'>('path');
  const [published, setPublished] = useState(false);
  const { setStep, context, pathInstance, selectedModel, setPathStatus } = useAppStore();
  const errors = useValidation();

  const handlePublish = () => {
    if (errors.length > 0) {
      toast.error('发布前请修复：' + errors[0]);
      return;
    }
    setPathStatus('发布');
    setPublished(true);
    toast.success('教学设计已发布！');
  };

  // 发布成功页
  if (published) {
    const allNodes = pathInstance.stages.flatMap(s => s.nodes);
    const totalActs = allNodes.reduce((t, n) => t + n.activities.length, 0);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-md w-full"
        >
          {/* 成功图标 */}
          <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={36} className="text-emerald-500" />
          </div>

          <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">发布成功</h2>
          <p className="text-sm text-muted-foreground mb-6">
            「{context.topic}」的教学设计已完成并发布
          </p>

          {/* 摘要卡片 */}
          <div className="bg-white border border-border/70 rounded-xl p-5 text-left mb-6 space-y-2.5"
            style={{ boxShadow: '0 1px 4px oklch(0.22 0.015 240 / 0.06)' }}
          >
            {[
              { label: '课题', value: context.topic },
              { label: '课时', value: `${context.duration} 分钟` },
              { label: '学段', value: context.studentGrade },
              { label: '路径模型', value: selectedModel?.modelName || '—' },
              { label: '认知节点', value: `${allNodes.length} 个` },
              { label: '学生活动', value: `${totalActs} 个` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => { setPublished(false); setPathStatus('草稿'); }}
              className="gap-2 text-sm"
            >
              <RotateCcw size={14} />
              返回预览
            </Button>
            <Button
              onClick={() => { setStep(1); }}
              className="gap-2 text-sm"
              style={{ background: 'oklch(0.42 0.09 240)' }}
            >
              <BookOpen size={14} />
              新建教学设计
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-semibold text-foreground mb-1.5">预览与发布</h1>
          <p className="text-sm text-muted-foreground">
            检查整体结构是否合理，确认后发布教学设计。
          </p>

          {/* 课题信息 */}
          {context.topic && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: 'oklch(0.42 0.09 240 / 0.1)',
                  color: 'oklch(0.35 0.09 240)',
                }}
              >
                {context.topic}
              </span>
              {context.duration && (
                <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  {context.duration} 分钟
                </span>
              )}
              {context.studentGrade && (
                <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  {context.studentGrade}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 校验错误 */}
        {errors.length > 0 && (
          <div className="mb-5 bg-amber-50 border border-amber-200/80 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-amber-600" />
              <span className="text-sm font-medium text-amber-800">发布前需处理以下问题</span>
            </div>
            <ul className="space-y-1">
              {errors.map((e, i) => (
                <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <span className="mt-0.5">·</span> {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 视图切换 */}
        <div className="flex items-center gap-1 mb-5 bg-muted/50 rounded-lg p-1 w-fit">
          <button
            onClick={() => setView('path')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              view === 'path' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <GitBranch size={13} />
            认知路径
          </button>
          <button
            onClick={() => setView('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              view === 'table' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutList size={13} />
            教学活动表
          </button>
        </div>

        {/* 内容区 */}
        {view === 'path' ? <CognitivePath /> : <ActivityTable />}

        {/* 底部操作 */}
        <div className="mt-10 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(4)}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={16} />
            返回
          </Button>
          <Button
            onClick={handlePublish}
            disabled={errors.length > 0}
            className="gap-2 px-6"
            style={errors.length === 0 ? { background: 'oklch(0.42 0.09 240)' } : {}}
          >
            <Send size={15} />
            确认发布
          </Button>
        </div>
      </div>
    </div>
  );
}

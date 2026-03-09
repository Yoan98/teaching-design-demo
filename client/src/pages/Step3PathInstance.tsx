// Step 3: 路径实例编辑
// 设计哲学：左侧阶段导航（粘性）+ 中间节点瀑布流，节点卡片精致可读
// 验证点：老师是否自然修改节点目标与逻辑关系

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, Plus, Trash2, Copy,
  Clock, AlertTriangle, ChevronDown, ChevronUp, Edit2, Check, GripVertical
} from 'lucide-react';
import { useAiPanel } from '@/App';
import { AiTrigger } from '@/components/AiPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import {
  useAppStore, getTotalTime, getNodeTypeColor, getLogicRelationColor,
  type Node, type LogicRelation
} from '@/lib/store';

const NODE_TYPES = [
  '概念理解', '比较分析', '实验探究', '因果推断', '综合讨论',
  '抽象总结', '迁移应用', '问题建构', '变量控制', '解释推理', '实验操作'
];

const LOGIC_RELATIONS: LogicRelation[] = ['建立', '对比', '推翻', '应用'];

// 时间分配状态条
function TimeBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const isOver = used > total;
  const isWarn = used > total * 0.9 && !isOver;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full transition-colors duration-300 ${
            isOver ? 'bg-red-400' : isWarn ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isOver && <AlertTriangle size={12} className="text-red-500" />}
        <span className={`text-xs tabular-nums ${
          isOver ? 'text-red-500 font-medium' : isWarn ? 'text-amber-600' : 'text-muted-foreground'
        }`}>
          {used} / {total} 分钟
        </span>
        {!isOver && (
          <span className="text-xs text-muted-foreground/60">
            · 剩余 {total - used} 分
          </span>
        )}
      </div>
    </div>
  );
}

// 节点卡片
function NodeCard({ node, stageId, index, total }: {
  node: Node;
  stageId: string;
  index: number;
  total: number;
}) {
  const { updateNode, deleteNode, moveNode } = useAppStore();
  const { panelState, openPanel } = useAiPanel();
  const [editing, setEditing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleCopy = () => {
    const pi = useAppStore.getState().pathInstance;
    const stages = pi.stages.map(stage => {
      if (stage.stageId !== stageId) return stage;
      const newNode: Node = {
        ...node,
        nodeId: nanoid(),
        learningGoal: node.learningGoal + '（副本）',
        activities: [],
        expanded: false,
      };
      const idx = stage.nodes.findIndex(n => n.nodeId === node.nodeId);
      const nodes = [...stage.nodes];
      nodes.splice(idx + 1, 0, newNode);
      return { ...stage, nodes };
    });
    useAppStore.setState(s => ({ pathInstance: { ...s.pathInstance, stages } }));
    toast.success('已复制节点');
    setShowMenu(false);
  };

  const handleDelete = () => {
    deleteNode(node.nodeId);
    setShowMenu(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={`
        relative bg-white rounded-xl border transition-all duration-200 overflow-hidden
        ${editing
          ? 'border-primary/50 shadow-md'
          : 'border-border/70 hover:border-primary/25 hover:shadow-sm'
        }
      `}
      style={editing ? { boxShadow: '0 2px 12px oklch(0.42 0.09 240 / 0.1)' } : {}}
    >
      {/* 左侧节点类型色条 */}
      <div className="flex">
        <div className="w-1 shrink-0 rounded-l-xl"
          style={{ background: editing ? 'oklch(0.42 0.09 240)' : 'transparent' }}
        />

        <div className="flex-1 p-4">
          {/* 顶部行 */}
          <div className="flex items-start gap-3">
            {/* 序号 */}
            <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
              <GripVertical size={13} className="text-muted-foreground/30" />
              <span className="text-xs text-muted-foreground/60 font-mono leading-none">{index + 1}</span>
            </div>

            {/* 主内容 */}
            <div className="flex-1 min-w-0">
              {/* 节点类型 + 逻辑关系 + 时间 */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {editing ? (
                  <Select
                    value={node.nodeType}
                    onValueChange={(v) => updateNode(node.nodeId, { nodeType: v })}
                  >
                    <SelectTrigger className="h-6 text-xs w-28 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NODE_TYPES.map(t => (
                        <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getNodeTypeColor(node.nodeType)}`}>
                    {node.nodeType}
                  </span>
                )}

                {index > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground/40 text-xs">↑</span>
                    {editing ? (
                      <Select
                        value={node.logicRelation}
                        onValueChange={(v) => updateNode(node.nodeId, { logicRelation: v as LogicRelation })}
                      >
                        <SelectTrigger className="h-6 text-xs w-20 border-border/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LOGIC_RELATIONS.map(r => (
                            <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`text-xs font-medium ${getLogicRelationColor(node.logicRelation)}`}>
                        {node.logicRelation}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1 ml-auto">
                  <Clock size={11} className="text-muted-foreground/50" />
                  {editing ? (
                    <input
                      type="number"
                      value={node.estimatedTime}
                      onChange={(e) => updateNode(node.nodeId, { estimatedTime: parseInt(e.target.value) || 0 })}
                      className="w-12 h-5 text-xs text-center border border-border/60 rounded bg-white"
                      min={1} max={60}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{node.estimatedTime} 分钟</span>
                  )}
                </div>
              </div>

              {/* 学习目标 */}
              {editing ? (
                <Input
                  value={node.learningGoal}
                  onChange={(e) => updateNode(node.nodeId, { learningGoal: e.target.value })}
                  placeholder="本节点认知目标..."
                  className="text-sm h-8 mb-2 bg-white/80"
                  autoFocus
                />
              ) : (
                <p className="text-sm text-foreground leading-snug mb-1">
                  {node.learningGoal || (
                    <span className="text-muted-foreground/60 italic text-xs">点击编辑填写学习目标</span>
                  )}
                </p>
              )}

              {/* 教师行为（编辑时显示） */}
              {editing && (
                <Input
                  value={node.teacherSupportBehavior}
                  onChange={(e) => updateNode(node.nodeId, { teacherSupportBehavior: e.target.value })}
                  placeholder="教师支持行为（可选）..."
                  className="text-sm h-8 mt-1.5 bg-white/80"
                />
              )}

              {/* 活动摘要 */}
              {!editing && node.activities.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-xs text-muted-foreground/70">
                    {node.activities.length} 个活动 · {node.activities.reduce((t, a) => t + a.estimatedTime, 0)} 分钟
                  </span>
                </div>
              )}
            </div>

            {/* 操作区 */}
            <div className="flex items-center gap-1 shrink-0">
              {/* AI 辅助按钮 */}
              <AiTrigger
                context="path-node"
                nodeId={node.nodeId}
                panelState={panelState}
                onOpen={openPanel}
                size="sm"
              />
              <button
                onClick={() => setEditing(!editing)}
                className={`p-1.5 rounded-lg transition-all duration-150 ${
                  editing
                    ? 'text-white'
                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted'
                }`}
                style={editing ? { background: 'oklch(0.42 0.09 240)' } : {}}
              >
                {editing ? <Check size={13} /> : <Edit2 size={13} />}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                >
                  <span className="text-sm leading-none font-bold">···</span>
                </button>
                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      className="absolute right-0 top-8 bg-white border border-border rounded-xl shadow-lg z-20 w-32 py-1.5 overflow-hidden"
                    >
                      {index > 0 && (
                        <button
                          onClick={() => { moveNode(node.nodeId, 'up'); setShowMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2 transition-colors"
                        >
                          <ChevronUp size={12} /> 上移
                        </button>
                      )}
                      {index < total - 1 && (
                        <button
                          onClick={() => { moveNode(node.nodeId, 'down'); setShowMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2 transition-colors"
                        >
                          <ChevronDown size={12} /> 下移
                        </button>
                      )}
                      <button
                        onClick={handleCopy}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2 transition-colors"
                      >
                        <Copy size={12} /> 复制
                      </button>
                      <div className="my-1 border-t border-border/50" />
                      <button
                        onClick={handleDelete}
                        className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 size={12} /> 删除
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Step3PathInstance() {
  const { pathInstance, selectedModel, context, addNode, setStep } = useAppStore();
  const [activeStageId, setActiveStageId] = useState<string>(
    pathInstance.stages[0]?.stageId || ''
  );

  const totalTime = context.duration || 40;
  const usedTime = getTotalTime(pathInstance);

  const handleNext = () => {
    const emptyStages = pathInstance.stages.filter(s => s.nodes.length === 0);
    if (emptyStages.length > 0) {
      toast.error(`以下阶段没有节点：${emptyStages.map(s => s.stageType).join('、')}`);
      return;
    }
    setStep(4);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 粘性时间状态栏 */}
      <div className="sticky top-[56px] z-40 bg-white/90 backdrop-blur-sm border-b border-border/50 px-4 py-2.5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-muted-foreground shrink-0">时间分配</span>
            <div className="flex-1">
              <TimeBar used={usedTime} total={totalTime} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 flex gap-6">
        {/* ── 左侧：阶段导航 ── */}
        <div className="w-40 shrink-0">
          <div className="sticky top-28">
            <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">阶段</p>
            <div className="space-y-1">
              {pathInstance.stages.map((stage, idx) => {
                const stageTime = stage.nodes.reduce((t, n) => t + n.estimatedTime, 0);
                const isActive = stage.stageId === activeStageId;
                return (
                  <button
                    key={stage.stageId}
                    onClick={() => {
                      setActiveStageId(stage.stageId);
                      document.getElementById(`stage-${stage.stageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`
                      w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150
                      ${isActive
                        ? 'border'
                        : 'hover:bg-muted/60 border border-transparent'
                      }
                    `}
                    style={isActive ? {
                      background: 'oklch(0.42 0.09 240 / 0.08)',
                      borderColor: 'oklch(0.42 0.09 240 / 0.25)',
                    } : {}}
                  >
                    <div className="text-xs font-medium leading-snug mb-0.5"
                      style={isActive ? { color: 'oklch(0.35 0.09 240)' } : { color: 'inherit' }}
                    >
                      {idx + 1}. {stage.stageType}
                    </div>
                    <div className="text-xs text-muted-foreground/60">
                      {stage.nodes.length} 节点 · {stageTime} 分
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── 中间：节点瀑布流 ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <h1 className="font-serif text-xl font-semibold text-foreground">路径实例编辑</h1>
            {selectedModel && (
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                {selectedModel.modelName}
              </span>
            )}
          </div>

          <div className="space-y-7">
            {pathInstance.stages.map((stage, stageIdx) => (
              <div
                key={stage.stageId}
                id={`stage-${stage.stageId}`}
                className="scroll-mt-32"
              >
                {/* 阶段标题 */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full text-xs flex items-center justify-center font-semibold text-muted-foreground bg-muted">
                      {stageIdx + 1}
                    </span>
                    <h3 className="font-serif font-semibold text-sm text-foreground">{stage.stageType}</h3>
                  </div>
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-xs text-muted-foreground/60 tabular-nums">
                    {stage.nodes.reduce((t, n) => t + n.estimatedTime, 0)} 分钟
                  </span>
                </div>

                {/* 节点列表 */}
                <div className="space-y-2.5 pl-4 border-l-2 border-border/30">
                  <AnimatePresence mode="popLayout">
                    {stage.nodes.map((node, nodeIdx) => (
                      <NodeCard
                        key={node.nodeId}
                        node={node}
                        stageId={stage.stageId}
                        index={nodeIdx}
                        total={stage.nodes.length}
                      />
                    ))}
                  </AnimatePresence>

                  {/* 新增节点 */}
                  <button
                    onClick={() => addNode(stage.stageId)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-border/50 rounded-xl text-xs text-muted-foreground/60 hover:border-primary/30 hover:text-primary/70 transition-all duration-200"
                  >
                    <Plus size={13} />
                    在此阶段新增节点
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 底部操作 */}
          <div className="mt-10 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep(2)}
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
              进入活动展开
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 1: 课程上下文页面
// 设计哲学：温暖专业教育工具风格
// 核心改进：
//   1. 顶部文件上传区 → 模拟 AI 提取 → 用户逐项确认修改
//   2. 去掉「确认并锁定」按钮，改为每块底部「确认此部分 ✓」的轻量确认
//   3. 已确认块显示绿色左边框 + 勾，点击可展开修改

import { useState, useRef, useCallback } from 'react';
import { useAiPanel } from '@/App';
import { AiTrigger } from '@/components/AiPanel';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Loader2, Check, ChevronDown, ChevronUp,
  Plus, X, ChevronRight, Sparkles, Edit3, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  useAppStore,
  type Duration,
  type CourseType,
  type StudentGrade,
  type StudentLevel,
} from '@/lib/store';
import { parseTeachingFile } from '@/lib/file-parser';
import { extractContextByLLM } from '@/lib/ai-service';

const DURATIONS: Duration[] = [35, 40, 60, 90, 120];
const STUDENT_GRADES: StudentGrade[] = ['小低（1-3年级）', '小高（4-6年级）', '初中', '高中', '中职', '高职', '大学本科'];
const STUDENT_LEVELS: StudentLevel[] = ['基础', '中等', '进阶'];
const EXEC_CONSTRAINT_OPTIONS = {
  deviceType: ['无设备', '平板', '电脑'] as const,
  softwareEnvironment: ['浏览器', 'Python环境', 'AI平台'] as const,
  materialLevel: ['无材料', '简单材料（纸笔）', '需提前准备', '需购买'] as const,
  prepTime: ['无准备', '课前5分钟', '课前30分钟'] as const,
  spaceMode: ['个体', '小组', '全班'] as const,
  managementLevel: ['低', '中', '高'] as const,
  costLevel: [0, '低', '需预算'] as const,
};

// ─── 文件上传区 ───────────────────────────────────────────────

type UploadState = 'idle' | 'dragging' | 'uploading' | 'extracting' | 'done';

function FileUploadZone({ onExtracted }: { onExtracted: () => void }) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { updateContext } = useAppStore();
  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setUploadState('uploading');
    setProgress(0);

    try {
      setProgress(15);
      await new Promise((resolve) => setTimeout(resolve, 180));
      setProgress(30);

      const fileText = await parseTeachingFile(file);
      if (!fileText.trim()) {
        throw new Error('文件解析后为空，请检查文件内容');
      }

      setUploadState('extracting');
      setProgress(45);

      const extracted = await extractContextByLLM(fileText);
      setProgress(100);

      updateContext(extracted);
      setUploadState('done');
      onExtracted();
      toast.success('已从文件中提取课程信息，请逐项确认');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '文件解析失败';
      toast.error(msg);
      setUploadState('idle');
      setProgress(0);
      setFileName('');
    }
  }, [updateContext, onExtracted]);

  const handleFile = (file: File) => {
    if (!file) return;
    void processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setUploadState('idle');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setUploadState('dragging');
  };

  const handleDragLeave = () => {
    setUploadState('idle');
  };

  if (uploadState === 'done') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-6"
      >
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <FileText size={15} className="text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-emerald-800 truncate">{fileName}</p>
          <p className="text-xs text-emerald-600">已提取 7 项课程信息，请在下方逐项确认</p>
        </div>
        <button
          onClick={() => { setUploadState('idle'); setFileName(''); setProgress(0); }}
          className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 shrink-0"
        >
          <RotateCcw size={12} /> 重新上传
        </button>
      </motion.div>
    );
  }

  return (
    <div className="mb-6">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => (uploadState === 'idle' || uploadState === 'dragging') && fileRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer
          ${uploadState === 'dragging' ? 'border-primary/60 bg-primary/4' : 'border-border hover:border-primary/40 hover:bg-primary/3'}
          ${(uploadState === 'uploading' || uploadState === 'extracting') ? 'cursor-default' : ''}
        `}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {uploadState === 'idle' || uploadState === 'dragging' ? (
          <div className="flex flex-col items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              uploadState === 'dragging' ? 'bg-primary/15' : 'bg-muted'
            }`}>
              <Upload size={20} className={uploadState === 'dragging' ? 'text-primary' : 'text-muted-foreground'} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">上传教案或课程材料</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                支持 PDF、Word、TXT、Markdown · 拖拽或点击上传
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
              <Sparkles size={11} className="text-primary/60" />
              <span>AI 将自动提取教学主题、核心问题、概念等信息</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              {uploadState === 'uploading' ? (
                <Upload size={20} className="text-primary" />
              ) : (
                <Sparkles size={20} className="text-primary animate-pulse" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {uploadState === 'uploading' ? '正在上传文件…' : 'AI 正在提取课程信息…'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{fileName}</p>
            </div>
            {/* 进度条 */}
            <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 分隔线 */}
      <div className="flex items-center gap-3 mt-5 mb-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">或手动填写</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    </div>
  );
}

// ─── 确认块组件 ───────────────────────────────────────────────

function ContextBlock({
  index,
  title,
  subtitle,
  isLocked,
  isDisabled,
  onConfirm,
  onUnlock,
  aiContext,
  children,
}: {
  index: number;
  title: string;
  subtitle: string;
  isLocked: boolean;
  isDisabled: boolean;
  onConfirm: () => void;
  onUnlock: () => void;
  aiContext: import('@/components/AiPanel').AiContext;
  children: React.ReactNode;
}) {
  const { panelState, openPanel } = useAiPanel();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.div
      layout
      className={`
        relative rounded-xl border transition-all duration-300 overflow-hidden
        ${isLocked
          ? 'border-emerald-200 bg-emerald-50/30 td-confirmed-stripe'
          : isDisabled
            ? 'border-border/50 bg-muted/30 opacity-60'
            : 'border-border bg-card shadow-sm'
        }
      `}
      style={!isLocked && !isDisabled ? {
        boxShadow: '0 1px 4px oklch(0.22 0.015 240 / 0.06)'
      } : {}}
    >
      {/* 已确认左边框 */}
      {isLocked && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400 rounded-l-xl" />
      )}

      {/* 块头部 */}
      <div
        className={`flex items-center justify-between px-6 py-4 ${isLocked ? 'cursor-pointer' : ''}`}
        onClick={() => isLocked && setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <div className={`
            w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold shrink-0
            ${isLocked ? 'bg-emerald-500 text-white' : isDisabled ? 'bg-muted text-muted-foreground' : 'text-white'}
          `}
          style={!isLocked && !isDisabled ? { background: 'oklch(0.42 0.09 240)' } : {}}
          >
            {isLocked ? <Check size={14} strokeWidth={2.5} /> : index}
          </div>
          <div>
            <h2 className="font-serif font-semibold text-base text-foreground leading-tight">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* AI 按钮：未锁定且非禁用时显示 */}
          {!isDisabled && (
            <AiTrigger
              context={aiContext}
              panelState={panelState}
              onOpen={openPanel}
              size="sm"
            />
          )}
          {isLocked ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onUnlock(); }}
                className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 transition-colors px-2 py-1 rounded-md hover:bg-emerald-100/60"
              >
                <Edit3 size={12} /> 修改
              </button>
              <div className="text-muted-foreground/50">
                {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </div>
            </>
          ) : isDisabled ? (
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              请先完成上一步
            </span>
          ) : null}
        </div>
      </div>

      {/* 块内容 */}
      <AnimatePresence initial={false}>
        {!(isLocked && collapsed) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className={`px-6 pb-5 ${isDisabled ? 'pointer-events-none' : ''}`}>
              <div className="border-t border-border/50 pt-4">
                {children}
              </div>

              {/* 确认按钮 */}
              {!isLocked && !isDisabled && (
                <div className="mt-5 flex justify-end">
                  <button
                    onClick={onConfirm}
                    className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-white transition-all duration-200 hover:opacity-90 active:scale-95"
                    style={{ background: 'oklch(0.42 0.09 240)' }}
                  >
                    <Check size={14} />
                    确认此部分
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────

export default function Step1Context() {
  const { context, updateContext, lockBlock, setStep } = useAppStore();
  const [newConcept, setNewConcept] = useState('');

  const allLocked = context.block1Locked && context.block2Locked && context.block3Locked;

  const handleLock = (block: 1 | 2 | 3) => {
    if (block === 1) {
      if (!context.topic.trim()) { toast.error('请填写教学主题'); return; }
      if (!context.coreQuestion.trim()) { toast.error('请填写核心问题'); return; }
      if (context.concepts.length < 1) { toast.error('请至少添加一个核心概念'); return; }
    }
    if (block === 2) {
      if (!context.ability.trim()) { toast.error('请填写目标能力'); return; }
      if (!context.competency.trim()) { toast.error('请填写核心素养'); return; }
    }
    if (block === 3) {
      if (!context.duration) { toast.error('请选择课时长度'); return; }
      if (!context.courseType) { toast.error('请选择课程类型'); return; }
      if (!context.studentGrade) { toast.error('请选择学生学段'); return; }
    }
    lockBlock(block);
  };

  const addConcept = () => {
    if (!newConcept.trim()) return;
    if (context.concepts.length >= 6) { toast.warning('核心概念最多 6 个'); return; }
    updateContext({ concepts: [...context.concepts, newConcept.trim()] });
    setNewConcept('');
  };

  const removeConcept = (idx: number) => {
    if (context.block1Locked) return;
    updateContext({ concepts: context.concepts.filter((_, i) => i !== idx) });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* 页面标题 */}
        <div className="mb-7">
          <h1 className="font-serif text-2xl font-semibold text-foreground mb-1.5">
            课程上下文
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            上传教案或课程材料，AI 将自动提取关键信息；也可直接手动填写，逐步确认后进入下一步。
          </p>
        </div>

        {/* 文件上传区 */}
        <FileUploadZone onExtracted={() => {}} />

        {/* 三块上下文 */}
        <div className="space-y-4">

          {/* 块 1：知识核心 */}
          <ContextBlock
            index={1}
            title="知识核心"
            subtitle="教学主题、核心问题与关键概念"
            isLocked={context.block1Locked}
            isDisabled={false}
            onConfirm={() => handleLock(1)}
            onUnlock={() => updateContext({ block1Locked: false })}
            aiContext="context-block1"
          >
            <div className="space-y-4">
              {/* 教学主题 */}
              <div>
                <label className="td-field-label">教学主题</label>
                <Input
                  value={context.topic}
                  onChange={(e) => updateContext({ topic: e.target.value })}
                  placeholder="例：人工智能三次浪潮、K-means 聚类算法"
                  className="text-sm bg-white/80"
                />
              </div>

              {/* 核心问题 */}
              <div>
                <label className="td-field-label">核心问题</label>
                <Input
                  value={context.coreQuestion}
                  onChange={(e) => updateContext({ coreQuestion: e.target.value })}
                  placeholder="例：为什么人工智能经历多次低谷？"
                  className="text-sm bg-white/80"
                />
              </div>

              {/* 核心概念 */}
              <div>
                <label className="td-field-label">
                  核心概念
                  <span className="ml-1.5 font-normal normal-case text-muted-foreground/60">3–6 个</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2.5 min-h-[28px]">
                  <AnimatePresence>
                    {context.concepts.map((c, i) => (
                      <motion.span
                        key={c + i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium"
                        style={{
                          background: 'oklch(0.42 0.09 240 / 0.1)',
                          color: 'oklch(0.35 0.09 240)',
                          border: '1px solid oklch(0.42 0.09 240 / 0.2)',
                        }}
                      >
                        {c}
                        {!context.block1Locked && (
                          <button onClick={() => removeConcept(i)} className="hover:opacity-60 transition-opacity">
                            <X size={11} />
                          </button>
                        )}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
                {!context.block1Locked && (
                  <div className="flex gap-2">
                    <Input
                      value={newConcept}
                      onChange={(e) => setNewConcept(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addConcept()}
                      placeholder="输入概念，按 Enter 添加"
                      className="text-sm h-8 bg-white/80"
                    />
                    <Button variant="outline" size="sm" onClick={addConcept} className="h-8 px-3 shrink-0">
                      <Plus size={14} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </ContextBlock>

          {/* 块 2：能力目标 */}
          <ContextBlock
            index={2}
            title="能力目标"
            subtitle="学生应达到的能力与核心素养"
            isLocked={context.block2Locked}
            isDisabled={!context.block1Locked}
            onConfirm={() => handleLock(2)}
            onUnlock={() => updateContext({ block2Locked: false })}
            aiContext="context-block2"
          >
            <div className="space-y-4">
              <div>
                <label className="td-field-label">目标能力</label>
                <Textarea
                  value={context.ability}
                  onChange={(e) => updateContext({ ability: e.target.value })}
                  placeholder="例：能分析技术与社会条件的关系，能评价当前 AI 发展趋势"
                  className="text-sm min-h-[72px] resize-none bg-white/80"
                />
              </div>
              <div>
                <label className="td-field-label">核心素养</label>
                <Input
                  value={context.competency}
                  onChange={(e) => updateContext({ competency: e.target.value })}
                  placeholder="例：信息技术学科核心素养 · 计算思维"
                  className="text-sm bg-white/80"
                />
              </div>
            </div>
          </ContextBlock>

          {/* 块 3：课堂条件 */}
          <ContextBlock
            index={3}
            title="课堂条件"
            subtitle="课时长度、课程类型与学生学段"
            isLocked={context.block3Locked}
            isDisabled={!context.block2Locked}
            onConfirm={() => handleLock(3)}
            onUnlock={() => updateContext({ block3Locked: false })}
            aiContext="context-block3"
          >
            <div className="space-y-5">
              {/* 课时长度 */}
              <div>
                <label className="td-field-label">课时长度</label>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => updateContext({ duration: d })}
                      className={`td-pill-btn ${context.duration === d ? 'td-pill-btn-active' : 'td-pill-btn-inactive'}`}
                    >
                      {d} 分钟
                    </button>
                  ))}
                </div>
              </div>

              {/* 课程类型 */}
              <div>
                <label className="td-field-label">课程类型</label>
                <div className="flex flex-wrap gap-2">
                  {(['概念建构', '自主探究'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => updateContext({ courseType: t as CourseType })}
                      className={`td-pill-btn ${context.courseType === t ? 'td-pill-btn-active' : 'td-pill-btn-inactive'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 学生学段 */}
              <div>
                <label className="td-field-label">学生学段</label>
                <div className="flex flex-wrap gap-2">
                  {STUDENT_GRADES.map((g) => (
                    <button
                      key={g}
                      onClick={() => updateContext({ studentGrade: g })}
                      className={`td-pill-btn text-xs ${context.studentGrade === g ? 'td-pill-btn-active' : 'td-pill-btn-inactive'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 学生水平 */}
              <div>
                <label className="td-field-label">学生水平（可选）</label>
                <div className="flex flex-wrap gap-2">
                  {STUDENT_LEVELS.map((level) => (
                    <button
                      key={level}
                      onClick={() => updateContext({ studentLevel: level })}
                      className={`td-pill-btn text-xs ${context.studentLevel === level ? 'td-pill-btn-active' : 'td-pill-btn-inactive'}`}
                    >
                      {level}
                    </button>
                  ))}
                  {context.studentLevel && (
                    <button
                      onClick={() => updateContext({ studentLevel: null })}
                      className="td-pill-btn td-pill-btn-inactive text-xs"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>

              {/* 执行约束 */}
              <div>
                <label className="td-field-label">执行约束（活动生成过滤）</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-1.5">设备类型</p>
                    <div className="flex flex-wrap gap-1.5">
                      {EXEC_CONSTRAINT_OPTIONS.deviceType.map((item) => (
                        <button
                          key={item}
                          onClick={() => updateContext({ executionConstraints: { ...context.executionConstraints, deviceType: item } })}
                          className={`td-pill-btn text-xs ${context.executionConstraints.deviceType === item ? 'td-pill-btn-active' : 'td-pill-btn-inactive'}`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1.5">软件环境</p>
                    <div className="flex flex-wrap gap-1.5">
                      {EXEC_CONSTRAINT_OPTIONS.softwareEnvironment.map((item) => (
                        <button
                          key={item}
                          onClick={() => updateContext({ executionConstraints: { ...context.executionConstraints, softwareEnvironment: item } })}
                          className={`td-pill-btn text-xs ${context.executionConstraints.softwareEnvironment === item ? 'td-pill-btn-active' : 'td-pill-btn-inactive'}`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1.5">空间结构</p>
                    <div className="flex flex-wrap gap-1.5">
                      {EXEC_CONSTRAINT_OPTIONS.spaceMode.map((item) => (
                        <button
                          key={item}
                          onClick={() => updateContext({ executionConstraints: { ...context.executionConstraints, spaceMode: item } })}
                          className={`td-pill-btn text-xs ${context.executionConstraints.spaceMode === item ? 'td-pill-btn-active' : 'td-pill-btn-inactive'}`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1.5">管理复杂度</p>
                    <div className="flex flex-wrap gap-1.5">
                      {EXEC_CONSTRAINT_OPTIONS.managementLevel.map((item) => (
                        <button
                          key={item}
                          onClick={() => updateContext({ executionConstraints: { ...context.executionConstraints, managementLevel: item } })}
                          className={`td-pill-btn text-xs ${context.executionConstraints.managementLevel === item ? 'td-pill-btn-active' : 'td-pill-btn-inactive'}`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ContextBlock>
        </div>

        {/* 底部操作 */}
        <div className="mt-8 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {allLocked
              ? <span className="text-emerald-600 flex items-center gap-1.5"><Check size={13} /> 三部分均已确认</span>
              : '请逐步确认三部分内容'}
          </div>
          <Button
            onClick={() => {
              if (!allLocked) { toast.error('请确认全部三部分后继续'); return; }
              setStep(2);
            }}
            disabled={!allLocked}
            className="gap-2 px-6"
            style={allLocked ? { background: 'oklch(0.42 0.09 240)' } : {}}
          >
            进入路径模型选择
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Step 2: 认知路径模型选择
// 设计哲学：让老师「看见」路径节奏，而非阅读理论说明
// 卡片设计：阶段气泡流 + 节奏标签 + 展开说明

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, ArrowRight, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAppStore, PRESET_MODELS, type Model, generateSampleData } from '@/lib/store';

const RHYTHM_COLORS: Record<string, { bg: string; text: string }> = {
  '前慢后快': { bg: 'bg-amber-50', text: 'text-amber-700' },
  '均匀分布': { bg: 'bg-sky-50', text: 'text-sky-700' },
  '中间密集': { bg: 'bg-violet-50', text: 'text-violet-700' },
};

function ModelCard({ model, isSelected, onSelect }: {
  model: Model;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rhythm = RHYTHM_COLORS[model.suggestedRhythm] || { bg: 'bg-muted', text: 'text-muted-foreground' };

  return (
    <motion.div
      layout
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      className={`
        rounded-xl border-2 cursor-pointer transition-all duration-200 overflow-hidden
        ${isSelected
          ? 'border-primary/70 shadow-md'
          : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
        }
      `}
      style={isSelected ? {
        background: 'oklch(0.97 0.015 240)',
        borderColor: 'oklch(0.42 0.09 240)',
        boxShadow: '0 4px 16px oklch(0.42 0.09 240 / 0.12)'
      } : {}}
      onClick={onSelect}
    >
      <div className="p-5">
        {/* 头部 */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h3 className="font-serif font-semibold text-base text-foreground">{model.modelName}</h3>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'oklch(0.42 0.09 240)' }}
                >
                  <Check size={11} className="text-white" strokeWidth={2.5} />
                </motion.div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rhythm.bg} ${rhythm.text}`}>
                {model.suggestedRhythm}
              </span>
              <span className="text-xs text-muted-foreground">
                建议 {model.suggestedNodeRange} 个节点
              </span>
            </div>
          </div>
        </div>

        {/* 阶段流 */}
        <div className="flex items-center flex-wrap gap-1.5 mb-4">
          {model.stages.map((stage, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <span className={`
                text-xs px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors
                ${isSelected
                  ? 'text-white'
                  : 'bg-muted/60 text-muted-foreground'
                }
              `}
              style={isSelected ? { background: 'oklch(0.42 0.09 240 / 0.85)' } : {}}
              >
                {stage}
              </span>
              {idx < model.stages.length - 1 && (
                <ArrowRight size={11} className={isSelected ? 'text-primary/50' : 'text-muted-foreground/30'} />
              )}
            </div>
          ))}
        </div>

        {/* 展开说明 */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? '收起说明' : '查看适用场景'}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
                {model.description}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function Step2Model() {
  const { selectedModel, selectModel, setStep, context, setPathInstance } = useAppStore();

  const handleConfirm = () => {
    if (!selectedModel) { toast.error('请先选择一个认知路径模型'); return; }
    const pi = generateSampleData(
      selectedModel.modelId,
      selectedModel.stages,
      context.duration || 40
    );
    setPathInstance(pi);
    toast.success(`已选择「${selectedModel.modelName}」`);
    setTimeout(() => setStep(3), 400);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-semibold text-foreground mb-1.5">
            选择认知路径模型
          </h1>
          <p className="text-sm text-muted-foreground">
            模型决定课堂的阶段节奏。选择最适合本节课学习目标的路径。
          </p>

          {/* 课题信息条 */}
          {context.topic && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">当前课题：</span>
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
              {context.courseType && (
                <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  {context.courseType}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 模型卡片 */}
        <div className="space-y-3">
          {PRESET_MODELS.map((model) => (
            <ModelCard
              key={model.modelId}
              model={model}
              isSelected={selectedModel?.modelId === model.modelId}
              onSelect={() => selectModel(model)}
            />
          ))}
        </div>

        {/* 底部操作 */}
        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(1)}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={16} />
            返回
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedModel}
            className="gap-2 px-6"
            style={selectedModel ? { background: 'oklch(0.42 0.09 240)' } : {}}
          >
            {selectedModel ? `使用「${selectedModel.modelName}」` : '请先选择模型'}
            <ChevronRight size={16} />
          </Button>
        </div>

        {selectedModel && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            将基于此模型生成 {selectedModel.suggestedNodeRange} 个认知节点的路径实例
          </p>
        )}
      </div>
    </div>
  );
}

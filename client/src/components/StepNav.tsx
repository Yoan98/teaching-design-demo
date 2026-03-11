// 步骤进度条组件
// 设计哲学：温暖专业，顶部固定，5步全程可见
// 已完成：翠绿勾；当前：石板蓝实心；未来：灰色虚线

import { Check } from 'lucide-react';
import { useAppStore, type Step } from '@/lib/store';
import AISettingsDialog from '@/components/AISettingsDialog';

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: '课程上下文' },
  { id: 2, label: '路径模型' },
  { id: 3, label: '路径实例' },
  { id: 4, label: '活动展开' },
  { id: 5, label: '预览发布' },
];

export default function StepNav() {
  const currentStep = useAppStore((s) => s.currentStep);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-border/60"
      style={{ boxShadow: '0 1px 8px oklch(0.22 0.015 240 / 0.06)' }}
    >
      <div className="max-w-4xl mx-auto px-6 py-0">
        <div className="flex items-center h-14 gap-8">
          {/* 品牌 */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'oklch(0.42 0.09 240)' }}>
              <span className="text-white text-xs font-bold font-serif">教</span>
            </div>
            <span className="font-serif text-sm font-semibold text-foreground tracking-wide hidden sm:block">
              教学活动设计
            </span>
          </div>

          {/* 步骤条 */}
          <div className="flex items-center flex-1 gap-0">
            {STEPS.map((step, idx) => {
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              const isLocked = currentStep < step.id;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  {/* 节点 + 标签 */}
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold
                      transition-all duration-400
                      ${isCompleted ? 'bg-emerald-500 text-white' : ''}
                      ${isCurrent ? 'text-white ring-2 ring-offset-1 ring-primary/30' : ''}
                      ${isLocked ? 'bg-slate-100 text-slate-400 border border-slate-200' : ''}
                    `}
                    style={isCurrent ? { background: 'oklch(0.42 0.09 240)' } : {}}
                    >
                      {isCompleted ? <Check size={13} strokeWidth={2.5} /> : step.id}
                    </div>
                    <span className={`
                      text-[10px] whitespace-nowrap hidden sm:block leading-none
                      ${isCurrent ? 'font-semibold' : 'font-normal'}
                      ${isCompleted ? 'text-emerald-600' : ''}
                      ${isLocked ? 'text-slate-400' : ''}
                    `}
                    style={isCurrent ? { color: 'oklch(0.42 0.09 240)' } : {}}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* 连接线 */}
                  {idx < STEPS.length - 1 && (
                    <div className="flex-1 mx-2 mt-[-10px] h-px relative overflow-hidden">
                      <div className="absolute inset-0 bg-slate-200" />
                      <div
                        className="absolute inset-0 bg-emerald-400 transition-all duration-500"
                        style={{ width: isCompleted ? '100%' : '0%' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 步骤计数 */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground tabular-nums">
              {currentStep} / 5
            </span>
            <AISettingsDialog />
          </div>
        </div>
      </div>
    </header>
  );
}

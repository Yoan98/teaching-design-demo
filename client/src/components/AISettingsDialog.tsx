import { useMemo, useState } from 'react';
import { Settings2, RefreshCcw, Save, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  useAIConfigStore,
  getEffectiveLLMConfig,
  getPromptTemplateByKey,
} from '@/lib/ai-store';
import {
  DEFAULT_PROMPTS,
  PROMPT_LABELS,
  PROMPT_VARIABLE_EXAMPLES,
  PROMPT_IMPACTS,
  type PromptKey,
} from '@/lib/prompt-registry';
import { toast } from 'sonner';

const PROMPT_KEYS: PromptKey[] = [
  'extractContext',
  'recommendModel',
  'generatePath',
  'optimizeNode',
  'generateActivities',
  'summarizePlan',
  'aiPanelGlobalSystem',
];

export default function AISettingsDialog() {
  const llmConfigOverride = useAIConfigStore((s) => s.llmConfigOverride);
  const setLLMConfigOverride = useAIConfigStore((s) => s.setLLMConfigOverride);
  const resetLLMConfigOverride = useAIConfigStore((s) => s.resetLLMConfigOverride);
  const setPromptOverride = useAIConfigStore((s) => s.setPromptOverride);
  const resetPromptOverride = useAIConfigStore((s) => s.resetPromptOverride);
  const resetPromptKeyOverride = useAIConfigStore((s) => s.resetPromptKeyOverride);
  const resetAllPromptOverrides = useAIConfigStore((s) => s.resetAllPromptOverrides);

  const effective = useMemo(() => getEffectiveLLMConfig(), [llmConfigOverride]);

  const [open, setOpen] = useState(false);
  const [activePromptKey, setActivePromptKey] = useState<PromptKey>('extractContext');
  const [llmDraft, setLlmDraft] = useState({
    baseURL: effective.baseURL,
    model: effective.model,
    apiKey: effective.apiKey,
    timeoutMs: String(effective.timeoutMs),
  });
  const [promptDraft, setPromptDraft] = useState(getPromptTemplateByKey('extractContext'));

  const loadPromptDraft = (key: PromptKey) => {
    setActivePromptKey(key);
    setPromptDraft(getPromptTemplateByKey(key));
  };

  const handleSaveLLM = () => {
    setLLMConfigOverride({
      baseURL: llmDraft.baseURL.trim(),
      model: llmDraft.model.trim(),
      apiKey: llmDraft.apiKey.trim(),
      timeoutMs: Number(llmDraft.timeoutMs) || 30000,
    });
    toast.success('LLM 配置已保存并生效');
  };

  const handleResetLLM = () => {
    resetLLMConfigOverride();
    const latest = getEffectiveLLMConfig();
    setLlmDraft({
      baseURL: latest.baseURL,
      model: latest.model,
      apiKey: latest.apiKey,
      timeoutMs: String(latest.timeoutMs),
    });
    toast.success('已恢复为 .env 默认配置');
  };

  const handleSavePrompt = () => {
    setPromptOverride(activePromptKey, 'system', promptDraft.system);
    setPromptOverride(activePromptKey, 'user', promptDraft.user);
    toast.success(`已保存「${PROMPT_LABELS[activePromptKey]}」system/user 提示词`);
  };

  const handleResetPromptPart = (part: 'system' | 'user') => {
    resetPromptOverride(activePromptKey, part);
    const latest = getPromptTemplateByKey(activePromptKey);
    setPromptDraft(latest);
    toast.success(`${part} 提示词已恢复默认`);
  };

  const handleResetPromptKey = () => {
    resetPromptKeyOverride(activePromptKey);
    setPromptDraft(DEFAULT_PROMPTS[activePromptKey]);
    toast.success('当前功能提示词已恢复默认');
  };

  const impact = PROMPT_IMPACTS[activePromptKey];

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          const latest = getEffectiveLLMConfig();
          setLlmDraft({
            baseURL: latest.baseURL,
            model: latest.model,
            apiKey: latest.apiKey,
            timeoutMs: String(latest.timeoutMs),
          });
          setPromptDraft(getPromptTemplateByKey(activePromptKey));
        }
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 size={14} />
          AI 配置
        </Button>
      </DialogTrigger>

      <DialogContent className="!top-0 !left-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none sm:!max-w-none rounded-none p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle>AI 配置中心</DialogTitle>
          <DialogDescription>
            全屏编辑 system/user 双提示词。保存后立即生效并写入本地存储。
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="llm" className="flex-1 min-h-0 overflow-hidden px-6 pb-4">
          <div className="pt-3 pb-2 shrink-0">
            <TabsList>
              <TabsTrigger value="llm">LLM 参数</TabsTrigger>
              <TabsTrigger value="prompts">提示词配置（System + User）</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="llm" className="h-full overflow-y-auto space-y-3 pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Base URL</label>
                <Input
                  value={llmDraft.baseURL}
                  onChange={(e) => setLlmDraft((prev) => ({ ...prev, baseURL: e.target.value }))}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Model</label>
                <Input
                  value={llmDraft.model}
                  onChange={(e) => setLlmDraft((prev) => ({ ...prev, model: e.target.value }))}
                  placeholder="gpt-4o-mini"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
                <Input
                  type="password"
                  value={llmDraft.apiKey}
                  onChange={(e) => setLlmDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Timeout (ms)</label>
                <Input
                  value={llmDraft.timeoutMs}
                  onChange={(e) => setLlmDraft((prev) => ({ ...prev, timeoutMs: e.target.value }))}
                  placeholder="30000"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              当前生效配置：`{effective.baseURL || '未设置'}` / `{effective.model || '未设置'}` / timeout {effective.timeoutMs}ms
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSaveLLM} className="gap-1.5">
                <Save size={13} /> 保存并生效
              </Button>
              <Button size="sm" variant="outline" onClick={handleResetLLM} className="gap-1.5">
                <RefreshCcw size={13} /> 恢复 .env 默认
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="prompts" className="h-full min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-4 min-h-0">
              <div className="border rounded-lg overflow-y-auto max-h-[calc(100vh-210px)] sticky top-0">
                {PROMPT_KEYS.map((key) => {
                  const active = key === activePromptKey;
                  return (
                    <button
                      key={key}
                      onClick={() => loadPromptDraft(key)}
                      className={`w-full text-left px-3.5 py-3 text-sm border-b last:border-b-0 transition-colors ${
                        active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40'
                      }`}
                    >
                      <div>{PROMPT_LABELS[key]}</div>
                      <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        {PROMPT_IMPACTS[key].purpose}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col min-h-0 gap-3 pb-4">
                <details className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                  <summary className="cursor-pointer select-none flex items-center gap-1.5 text-foreground font-medium">
                    <WandSparkles size={12} /> 作用说明与改动影响（点击展开）
                  </summary>
                  <div className="mt-2.5 space-y-2">
                    <div>
                      <span className="text-muted-foreground">这个提示词的作用：</span>
                      <div className="mt-1 text-foreground">{impact.purpose}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">触发时机：</span>
                      <div className="mt-1 text-foreground">{impact.trigger}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">修改后会影响：</span>
                      <div className="mt-1 flex flex-col gap-1">
                        {impact.changeImpact.map((line) => (
                          <span key={line} className="text-foreground">• {line}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">受影响字段/输出：</span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {impact.affects.map((item) => (
                          <span key={item} className="px-2 py-0.5 rounded-full border bg-background text-[11px]">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>

                <div className="text-xs text-muted-foreground flex items-center gap-4">
                  <span>System 变量：{PROMPT_VARIABLE_EXAMPLES[activePromptKey].system.join(' / ') || '无'}</span>
                  <span>User 变量：{PROMPT_VARIABLE_EXAMPLES[activePromptKey].user.join(' / ') || '无'}</span>
                </div>

                <div className="grid grid-cols-1 gap-4 min-h-0">
                  <div className="flex flex-col border rounded-lg p-3 bg-background">
                    <div className="text-sm font-medium text-foreground mb-2">System Prompt</div>
                    <Textarea
                      value={promptDraft.system}
                      onChange={(e) => setPromptDraft((prev) => ({ ...prev, system: e.target.value }))}
                      className="h-[36vh] max-h-[52vh] w-full resize-y overflow-auto [field-sizing:fixed] font-mono text-base leading-7"
                    />
                    <div className="mt-2">
                      <Button size="sm" variant="outline" onClick={() => handleResetPromptPart('system')}>
                        重置 System
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col border rounded-lg p-3 bg-background">
                    <div className="text-sm font-medium text-foreground mb-2">User Prompt</div>
                    <Textarea
                      value={promptDraft.user}
                      onChange={(e) => setPromptDraft((prev) => ({ ...prev, user: e.target.value }))}
                      className="h-[42vh] max-h-[60vh] w-full resize-y overflow-auto [field-sizing:fixed] font-mono text-base leading-7"
                    />
                    <div className="mt-2">
                      <Button size="sm" variant="outline" onClick={() => handleResetPromptPart('user')}>
                        重置 User
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" onClick={handleSavePrompt} className="gap-1.5">
                    <Save size={13} /> 保存当前功能提示词
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleResetPromptKey}>
                    重置当前功能
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      resetAllPromptOverrides();
                      setPromptDraft(DEFAULT_PROMPTS[activePromptKey]);
                      toast.success('已恢复全部默认提示词');
                    }}
                  >
                    恢复全部默认
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

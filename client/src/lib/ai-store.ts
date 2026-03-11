import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_PROMPTS,
  type PromptKey,
  type PromptPart,
  type PromptTemplate,
} from './prompt-registry';

export interface LLMConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface AiPanelStoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  appliedChanges?: string[];
  timestamp: number;
}

interface AIConfigState {
  llmConfigOverride: Partial<LLMConfig>;
  promptOverrides: Partial<Record<PromptKey, Partial<PromptTemplate>>>;
  aiPanelHistories: Record<string, AiPanelStoredMessage[]>;
  setLLMConfigOverride: (partial: Partial<LLMConfig>) => void;
  resetLLMConfigOverride: () => void;
  setPromptOverride: (key: PromptKey, part: PromptPart, prompt: string) => void;
  resetPromptOverride: (key: PromptKey, part: PromptPart) => void;
  resetPromptKeyOverride: (key: PromptKey) => void;
  resetAllPromptOverrides: () => void;
  setAiPanelHistory: (key: string, history: AiPanelStoredMessage[]) => void;
  clearAiPanelHistory: (key: string) => void;
}

const envDefaults: LLMConfig = {
  baseURL: import.meta.env.VITE_LLM_BASE_URL || '',
  apiKey: import.meta.env.VITE_LLM_API_KEY || '',
  model: import.meta.env.VITE_LLM_MODEL || '',
  timeoutMs: Number(import.meta.env.VITE_LLM_TIMEOUT_MS || 30000),
};

export const useAIConfigStore = create<AIConfigState>()(
  persist(
    (set) => ({
      llmConfigOverride: {},
      promptOverrides: {},
      aiPanelHistories: {},

      setLLMConfigOverride: (partial) =>
        set((state) => ({
          llmConfigOverride: {
            ...state.llmConfigOverride,
            ...partial,
          },
        })),

      resetLLMConfigOverride: () => set({ llmConfigOverride: {} }),

      setPromptOverride: (key, part, prompt) =>
        set((state) => ({
          promptOverrides: {
            ...state.promptOverrides,
            [key]: {
              ...(state.promptOverrides[key] || {}),
              [part]: prompt,
            },
          },
        })),

      resetPromptOverride: (key, part) =>
        set((state) => {
          const current = state.promptOverrides[key];
          if (!current) return state;

          const nextEntry = { ...current };
          delete nextEntry[part];

          const next = { ...state.promptOverrides };
          if (Object.keys(nextEntry).length === 0) {
            delete next[key];
          } else {
            next[key] = nextEntry;
          }
          return { promptOverrides: next };
        }),

      resetPromptKeyOverride: (key) =>
        set((state) => {
          const next = { ...state.promptOverrides };
          delete next[key];
          return { promptOverrides: next };
        }),

      resetAllPromptOverrides: () => set({ promptOverrides: {} }),

      setAiPanelHistory: (key, history) =>
        set((state) => ({
          aiPanelHistories: {
            ...state.aiPanelHistories,
            [key]: history,
          },
        })),

      clearAiPanelHistory: (key) =>
        set((state) => ({
          aiPanelHistories: {
            ...state.aiPanelHistories,
            [key]: [],
          },
        })),
    }),
    {
      name: 'teaching-design-ai-v2',
      version: 2,
      partialize: (state) => ({
        llmConfigOverride: state.llmConfigOverride,
        promptOverrides: state.promptOverrides,
        aiPanelHistories: state.aiPanelHistories,
      }),
    }
  )
);

export function getEffectiveLLMConfig(): LLMConfig {
  const override = useAIConfigStore.getState().llmConfigOverride;
  return {
    ...envDefaults,
    ...override,
    timeoutMs: Number(override.timeoutMs ?? envDefaults.timeoutMs),
  };
}

export function getPromptTemplateByKey(key: PromptKey): PromptTemplate {
  const override = useAIConfigStore.getState().promptOverrides[key] || {};
  return {
    system: override.system ?? DEFAULT_PROMPTS[key].system,
    user: override.user ?? DEFAULT_PROMPTS[key].user,
  };
}

export function getPromptPartByKey(key: PromptKey, part: PromptPart): string {
  return getPromptTemplateByKey(key)[part];
}

export function getPromptTemplateDefaults(): Record<PromptKey, PromptTemplate> {
  return DEFAULT_PROMPTS;
}

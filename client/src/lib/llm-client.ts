import { getEffectiveLLMConfig } from './ai-store';

export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export type LLMErrorKind =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'http'
  | 'invalid_response';

export class LLMClientError extends Error {
  kind: LLMErrorKind;
  status?: number;

  constructor(kind: LLMErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

interface CompleteOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

interface StreamOptions {
  messages: LLMMessage[];
  temperature?: number;
  onToken: (token: string) => void;
  onDone?: (fullText: string) => void;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new LLMClientError('timeout', `LLM 请求超时（>${timeoutMs}ms）`);
    }
    throw new LLMClientError('network', '网络错误或 CORS 拒绝，请检查 baseURL 与浏览器跨域配置');
  } finally {
    clearTimeout(timer);
  }
}

function toChatEndpoint(baseURL: string): string {
  return `${baseURL.replace(/\/$/, '')}/chat/completions`;
}

function ensureConfig() {
  const config = getEffectiveLLMConfig();
  if (!config.baseURL || !config.model || !config.apiKey) {
    throw new LLMClientError('invalid_response', 'LLM 配置不完整，请先在 AI 配置中填写 baseURL/model/apiKey');
  }
  return config;
}

function extractContent(json: any): string {
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((chunk) => (typeof chunk === 'string' ? chunk : chunk?.text || ''))
      .join('');
  }
  throw new LLMClientError('invalid_response', 'LLM 返回结构不符合 OpenAI Chat Completions 规范');
}

export async function completeLLM(options: CompleteOptions): Promise<string> {
  const config = ensureConfig();
  const response = await fetchWithTimeout(
    toChatEndpoint(config.baseURL),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens,
        stream: false,
        response_format: options.jsonMode ? { type: 'json_object' } : undefined,
      }),
    },
    config.timeoutMs
  );

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new LLMClientError('auth', `鉴权失败（${response.status}）：${text || '请检查 API Key'}`, response.status);
    }
    throw new LLMClientError('http', `LLM 请求失败（${response.status}）：${text || '未知错误'}`, response.status);
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new LLMClientError('invalid_response', 'LLM 返回不是 JSON');
  }

  return extractContent(json);
}

export async function streamLLM(options: StreamOptions): Promise<void> {
  const config = ensureConfig();
  const response = await fetchWithTimeout(
    toChatEndpoint(config.baseURL),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.6,
        stream: true,
      }),
    },
    config.timeoutMs
  );

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new LLMClientError('auth', `鉴权失败（${response.status}）：${text || '请检查 API Key'}`, response.status);
    }
    throw new LLMClientError('http', `LLM 流式请求失败（${response.status}）：${text || '未知错误'}`, response.status);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    const content = extractContent(json);
    options.onToken(content);
    options.onDone?.(content);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new LLMClientError('invalid_response', '流式响应体为空');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      try {
        const json = JSON.parse(payload);
        const token = json?.choices?.[0]?.delta?.content;
        if (typeof token === 'string' && token.length > 0) {
          fullText += token;
          options.onToken(token);
        }
      } catch {
        // ignore invalid SSE chunk
      }
    }
  }

  options.onDone?.(fullText);
}

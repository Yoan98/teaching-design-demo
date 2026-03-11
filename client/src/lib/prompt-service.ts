import { getPromptPartByKey } from './ai-store';
import type { PromptKey, PromptPart } from './prompt-registry';

function getByPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, source);
}

function toPromptValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function renderPrompt(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    return toPromptValue(getByPath(vars, path));
  });
}

export function getRenderedPromptPart(
  key: PromptKey,
  part: PromptPart,
  vars: Record<string, unknown>
): string {
  const template = getPromptPartByKey(key, part);
  return renderPrompt(template, vars);
}

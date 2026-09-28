import { ModelItem } from '../types';

/**
 * Safely extract the raw model code (e.g., "gpt-4o", "gemini-3.8-flash")
 * from either a ModelItem or a model ID string (which may contain a "providerId::" prefix).
 */
export function getRawModelId(modelOrId: ModelItem | string | undefined | null): string {
  if (!modelOrId) return '';
  const idStr = typeof modelOrId === 'string' ? modelOrId : (modelOrId.rawModelId || modelOrId.id);
  if (!idStr) return '';
  const doubleColonIdx = idStr.indexOf('::');
  if (doubleColonIdx !== -1) {
    return idStr.slice(doubleColonIdx + 2);
  }
  return idStr;
}

/**
 * Build a provider-scoped unique ID for storage in IndexedDB (e.g., "openai::gpt-4o", "custom::gpt-4o").
 */
export function buildUniqueModelId(providerId: string, rawModelId: string): string {
  const cleanRaw = getRawModelId(rawModelId);
  if (!providerId) return cleanRaw;
  return `${providerId}::${cleanRaw}`;
}

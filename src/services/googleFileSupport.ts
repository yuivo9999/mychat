/**
 * Google Gemini / Gemma attachment capability policy.
 *
 * Gemini and Gemma are different model families, but when they are hosted
 * through Google's Gemini API they use the same attachment transport.
 * Keep MIME routing here so new Google model IDs do not need a second
 * per-model file-support flag just to inherit the same API capability.
 *
 * Direct generateContent accepts PDF and text-like document inputs.
 * Binary office formats such as DOCX stay on the explicit local-text
 * fallback because they are not direct native generateContent inputs.
 */
export function supportsGoogleNativeFileMime(mimeType?: string): boolean {
  const mime = (mimeType || '').toLowerCase().split(';', 1)[0].trim();

  if (mime === 'application/pdf' || mime === 'application/json') return true;
  if (mime.startsWith('text/')) return true;

  return [
    'application/xml',
    'application/yaml',
    'application/sql',
  ].includes(mime);
}

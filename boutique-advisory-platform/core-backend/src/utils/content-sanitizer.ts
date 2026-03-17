/**
 * Lightweight content sanitizer for agreement text inputs.
 * This strips executable markup vectors and leaves plain content.
 */
export function sanitizeAgreementContent(input: string): string {
  return String(input)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/javascript:/gi, '')
    .replace(/\u0000/g, '')
    .trim();
}

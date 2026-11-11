/**
 * Security and sanitization utilities for LLM inputs and untrusted web content.
 */

// Patterns commonly used in indirect prompt injection attacks
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+|the\s+)?(previous|prior|above)\s+(instructions|directives|prompts)/gi,
  /disregard\s+(all\s+)?(previous|prior)\s+instructions/gi,
  /system\s+prompt\s*:/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /\[SYSTEM\]/gi,
  /\[ADMIN\]/gi,
  /reveal\s+your\s+(initial\s+)?(instructions|system\s+prompt|api\s+key)/gi,
];

/**
 * Sanitizes external untrusted content (e.g. web search snippets)
 * to neutralize indirect prompt injection attempts while preserving readable text.
 */
export function sanitizeUntrustedContent(content: string): string {
  if (!content) return '';

  let sanitized = content;

  // 1. Remove dangerous script and iframe HTML tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // 2. Neutralize injection triggers by defanging them
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => `[defanged: ${match.slice(0, 10)}...]`);
  }

  // 3. Prevent delimiter hijacking (strip markdown comment wrappers)
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');

  return sanitized;
}

/**
 * Wraps search results in a strict untrusted data isolation block
 * with clear boundary markers for the LLM.
 */
export function wrapInUntrustedBoundary(content: string): string {
  const clean = sanitizeUntrustedContent(content);
  return `<untrusted_search_data>\n${clean}\n</untrusted_search_data>`;
}


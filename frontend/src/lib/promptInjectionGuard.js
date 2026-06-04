const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
  /you\s+are\s+now\s+(?:a\s+)?(?:different|new|another)\s+(?:ai|model|assistant)/i,
  /disregard\s+(?:your\s+)?(?:system\s+prompt|instructions|guidelines)/i,
  /act\s+as\s+(?:if\s+)?(?:you\s+(?:have|had)\s+no|without)\s+(?:restrictions|limitations)/i,
  /<\s*(?:system|SYSTEM)\s*>/,
]

export function checkPromptInjection(message) {
  return INJECTION_PATTERNS.some((p) => p.test(message))
}

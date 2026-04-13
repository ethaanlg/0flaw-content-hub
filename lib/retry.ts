/**
 * Exécute fn avec jusqu'à maxAttempts tentatives.
 * Délai exponentiel : baseDelayMs * 2^attempt + jitter aléatoire.
 * Ne retente pas les erreurs HTTP 4xx (erreurs métier).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 500, label = 'operation' } = options

  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastError = err
      // Ne pas retenter les erreurs métier HTTP 4xx
      if (err instanceof Error && /\b(400|401|403|404|409|422)\b/.test(err.message)) {
        throw err
      }
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100
        console.warn(`[retry] ${label} — tentative ${attempt + 1}/${maxAttempts} échouée, retry dans ${Math.round(delay)}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

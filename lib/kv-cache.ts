// Vercel KV cache layer — 7 jours TTL sur les générations GPT-4o
// En local sans config KV (KV_REST_API_URL/KV_REST_API_TOKEN), le cache est silencieusement désactivé

function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
  // Import dynamique pour éviter l'erreur si le package n'est pas configuré
  const { createClient } = require('@vercel/kv')
  return createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  })
}

const TTL_SECONDS = 60 * 60 * 24 * 7 // 7 jours

export async function cachedOr<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const kv = getKV()
  if (!kv) return fn() // pas de cache en local sans config KV

  try {
    const cached = await (kv.get as (key: string) => Promise<T>)(key)
    if (cached !== null && cached !== undefined) return cached

    const result = await fn()
    await (kv.set as (key: string, value: T, options: { ex: number }) => Promise<void>)(key, result, { ex: TTL_SECONDS })
    return result
  } catch {
    // Si KV échoue, continuer sans cache
    return fn()
  }
}

export * from './types'

import type { Platform, PlatformAdapter } from './types'
import { linkedinAdapter } from './linkedin-adapter'
import { instagramAdapter } from './instagram-adapter'
import { xAdapter } from './x-adapter'
import { threadsAdapter } from './threads-adapter'

export const adapters: Record<Platform, PlatformAdapter> = {
  linkedin: linkedinAdapter,
  instagram: instagramAdapter,
  x: xAdapter,
  threads: threadsAdapter,
}

export function getAdapter(platform: Platform): PlatformAdapter {
  return adapters[platform]
}

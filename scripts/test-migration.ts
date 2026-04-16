// scripts/test-migration.ts
// Usage: npx tsx scripts/test-migration.ts
// Validates that all 3 generation functions return valid structures

import { generatePostDescription } from '../lib/claude'
import { generateCarouselSlides } from '../lib/slides-gen'
import { generateTextPost } from '../lib/text-post-gen'

const TEST_TOPICS = [
  { title: 'Le phishing en PME', topic: 'Sensibilisation anti-phishing pour PME françaises' },
  { title: 'Ransomware et PME', topic: 'Coût réel d\'un ransomware pour une PME de 50 salariés' },
]

async function run() {
  let passed = 0
  let failed = 0

  for (const { title, topic } of TEST_TOPICS) {
    console.log(`\n=== Testing topic: "${title}" ===`)

    // Test 1: Description generation
    try {
      const desc = await generatePostDescription(topic, 'v3')
      if (!desc || desc.length < 50) throw new Error(`Description too short: ${desc.length} chars`)
      console.log(`  ✅ Description (${desc.length} chars): ${desc.slice(0, 80)}...`)
      passed++
    } catch (e) {
      console.error(`  ❌ Description FAILED:`, e)
      failed++
    }

    // Test 2: Carousel generation
    try {
      const slides = await generateCarouselSlides(title, topic)
      if (slides.length !== 7) throw new Error(`Expected 7 slides, got ${slides.length}`)
      const types = slides.map(s => s.type)
      const expected = ['cover', 'problem', 'stat', 'insight', 'system', 'proof', 'cta']
      for (let i = 0; i < 7; i++) {
        if (types[i] !== expected[i]) throw new Error(`Slide ${i+1} type mismatch: ${types[i]} != ${expected[i]}`)
      }
      console.log(`  ✅ Carousel (7 slides): ${types.join(' → ')}`)
      passed++
    } catch (e) {
      console.error(`  ❌ Carousel FAILED:`, e)
      failed++
    }

    // Test 3: Text post generation
    try {
      const post = await generateTextPost(title, topic)
      if (!post.linkedin || post.linkedin.length < 100) throw new Error(`LinkedIn too short: ${post.linkedin?.length}`)
      if (!post.instagram || post.instagram.length < 50) throw new Error(`Instagram too short: ${post.instagram?.length}`)
      console.log(`  ✅ TextPost — LinkedIn: ${post.linkedin.length} chars, Instagram: ${post.instagram.length} chars`)
      passed++
    } catch (e) {
      console.error(`  ❌ TextPost FAILED:`, e)
      failed++
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
  if (failed > 0) process.exit(1)
}

run().catch(e => { console.error(e); process.exit(1) })

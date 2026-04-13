// OpenAI GPT-4o helper — génération de description de post

export async function generatePostDescription(
  topic: string,
  variant: 'v1' | 'v2' | 'v3' = 'v3'
): Promise<string> {
  const variantInstructions = {
    v1: 'V1 courte (3 lignes) : stat choc + question + hook. Commencer par le chiffre.',
    v2: 'V2 directe (4 lignes) : tension narrative + "swipe". Commencer par une affirmation.',
    v3: 'V3 maximale (5-6 lignes) : chiffre → cause → solution → CTA. La plus complète.'
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 600,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `Tu es un expert copywriter LinkedIn pour 0Flaw, une plateforme SaaS de sensibilisation cybersécurité pour PME/ETI françaises.

Règles voix 0Flaw :
- Direct, technique, sans bullshit, anti-fluff
- Phrases courtes, mots simples
- Jamais "innovant", "révolutionnaire", "solution" comme adjectif vague
- Chiffres concrets (ANSSI, Verizon DBIR, IBM)
- Cible : RSSI et DSI de PME/ETI françaises, débordés, pragmatiques
- Pas de "Je" au début
- 1 seul emoji maximum
- Finir par 4-5 hashtags : #Cybersécurité + hashtags spécifiques
- Jamais d'URL dans le texte (pénalise la portée LinkedIn)
- Répondre UNIQUEMENT avec la description, sans introduction ni explication`
        },
        {
          role: 'user',
          content: `Sujet du carrousel : "${topic}"\n\nRédige la description LinkedIn format ${variantInstructions[variant]}`
        }
      ]
    })
  })

  const data = await res.json()
  if (!res.ok) {
    const msg = data?.error?.message ?? `HTTP ${res.status}`
    throw new Error(`OpenAI API error (description): ${msg}`)
  }
  return data.choices?.[0]?.message?.content || ''
}

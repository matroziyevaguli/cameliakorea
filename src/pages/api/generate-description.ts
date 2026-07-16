import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser } from '@/lib/apiAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!(await getApiUser(req))) return res.status(401).json({ error: "Ruxsat yo'q" })

  const { name } = req.body as { name?: string }
  if (!name) return res.status(400).json({ error: 'name is required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const prompt = `You are a K-beauty copywriter for an Uzbek Telegram store, "Camelia Store".
Research this Korean skincare product using web search to find its real benefits,
key ingredients, skin type, and how to use it: "${name}".

Then write a short, warm, persuasive product description in UZBEK (Latin script)
for Uzbek women customers. Rules:
- 3–5 short lines, easy to read on a phone.
- Start with the main benefit, then 2–3 key points as bullet lines with tasteful
  emojis (✨🌿💧☀️).
- Mention skin type or how to use if relevant.
- Be honest — no medical claims or exaggerated promises.
- Do NOT include price, cost, or any English.
- Output ONLY the description text — no preamble, no quotes, no extra commentary.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    return res.status(502).json({ error: data.error?.message ?? 'Anthropic API error' })
  }

  const text = (data.content as { type: string; text?: string }[])
    .filter(block => block.type === 'text')
    .map(block => block.text ?? '')
    .join('')
    .trim()

  return res.status(200).json({ description: text })
}

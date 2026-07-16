import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name } = req.body as { name?: string }
  if (!name) return res.status(400).json({ error: 'name is required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const prompt = `Use web search to find the single best YouTube video for this Korean skincare product: "${name}". Prefer the official brand video or a popular honest review.
Return ONLY the full YouTube URL exactly as it appears in your search results — never invent or guess a URL. If no real YouTube video appears in the results, return exactly: NONE. Output only the URL or NONE, nothing else.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    return res.status(502).json({ error: data.error?.message ?? 'Anthropic API error' })
  }

  const text = (data.content as { type: string; text?: string }[])
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('')
    .trim()

  // If model returned NONE or no valid YouTube URL found, return null so the UI can show "not found"
  if (text.trim() === 'NONE') {
    return res.status(200).json({ url: null })
  }

  const match = text.match(/https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s]+/)
  if (!match) {
    return res.status(200).json({ url: null })
  }

  return res.status(200).json({ url: match[0] })
}

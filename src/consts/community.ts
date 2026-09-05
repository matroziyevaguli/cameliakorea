// Q&A topics for the community page (docs/community-prd.md). Slugs are stable; labels are the
// Uzbek UI text. Shared by the ask modal, the public filter chips, and the admin triage.
export const TOPICS: { value: string; label: string }[] = [
  { value: 'dasturchilik',     label: 'Dasturchilik' },
  { value: 'ingliz_tili',      label: 'Ingliz tili' },
  { value: 'koreys_tili',      label: 'Koreys tili' },
  { value: 'shaxsiy_maslahat', label: 'Shaxsiy maslahat' },
  { value: 'koreya',           label: 'Koreya' },
  { value: 'koreyada_ishlash', label: 'Koreyada ishlash' },
  { value: 'boshqa',           label: 'Boshqa' },
]

export const TOPIC_LABEL: Record<string, string> = Object.fromEntries(TOPICS.map(t => [t.value, t.label]))

// Fixed skincare taxonomy for the survey + product tagging (docs/ordering-and-survey-plan.md).
// Values are stable slugs stored in `product_tags`; labels are the Uzbek UI text. Keep the
// admin tag picker and the customer survey in sync by importing from here — never hardcode.

export type SkinType = 'normal' | 'dry' | 'oily' | 'combination' | 'sensitive'
export type Concern  = 'acne' | 'dryness' | 'oiliness' | 'aging' | 'pigmentation' | 'redness' | 'pores' | 'dullness'

export const SKIN_TYPES: { value: SkinType; label: string }[] = [
  { value: 'normal',      label: 'Normal' },
  { value: 'dry',         label: 'Quruq' },
  { value: 'oily',        label: "Yog'li" },
  { value: 'combination', label: 'Aralash' },
  { value: 'sensitive',   label: 'Sezgir' },
]

export const CONCERNS: { value: Concern; label: string }[] = [
  { value: 'acne',         label: 'Akne / toshmalar' },
  { value: 'dryness',      label: 'Quruqlik' },
  { value: 'oiliness',     label: "Yog'lilik" },
  { value: 'aging',        label: 'Ajin / qarish' },
  { value: 'pigmentation', label: "Dog'lar / pigmentatsiya" },
  { value: 'redness',      label: 'Qizarish / sezgirlik' },
  { value: 'pores',        label: 'Teshiklar' },
  { value: 'dullness',     label: 'Xiralik' },
]

export const SKIN_TYPE_LABEL: Record<string, string> = Object.fromEntries(SKIN_TYPES.map(t => [t.value, t.label]))
export const CONCERN_LABEL:   Record<string, string> = Object.fromEntries(CONCERNS.map(c => [c.value, c.label]))

// The two tag families stored in product_tags.tag_type.
export const TAG_TYPES = { skinType: 'skin_type', concern: 'concern' } as const

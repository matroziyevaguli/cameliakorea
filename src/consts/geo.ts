// Uzbekistan's 14 top-level divisions (12 viloyat + Toshkent shahri + Qoraqalpog'iston).
// Used by seller default-region (admin/sellers, seller settings) and customer checkout to route
// an order to the right seller. Kept as `CITIES`/`CITY_LABEL` to avoid churn — they hold regions.
export const CITIES: { value: string; label: string }[] = [
  { value: 'toshkent_shahri',   label: 'Toshkent shahri' },
  { value: 'toshkent_viloyati', label: 'Toshkent viloyati' },
  { value: 'andijon',           label: 'Andijon' },
  { value: 'buxoro',            label: 'Buxoro' },
  { value: 'fargona',           label: "Farg'ona" },
  { value: 'jizzax',            label: 'Jizzax' },
  { value: 'xorazm',            label: 'Xorazm' },
  { value: 'namangan',          label: 'Namangan' },
  { value: 'navoiy',            label: 'Navoiy' },
  { value: 'qashqadaryo',       label: 'Qashqadaryo' },
  { value: 'qoraqalpogiston',   label: "Qoraqalpog'iston" },
  { value: 'samarqand',         label: 'Samarqand' },
  { value: 'sirdaryo',          label: 'Sirdaryo' },
  { value: 'surxondaryo',       label: 'Surxondaryo' },
]

export const CITY_LABEL: Record<string, string> = Object.fromEntries(CITIES.map(c => [c.value, c.label]))

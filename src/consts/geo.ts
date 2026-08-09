// Cities the shop serves. Used by seller default-city (admin/sellers) and later by customer
// checkout to route an order to the right seller. `boshqa` = anywhere else (defaults to Gulshan).
export const CITIES: { value: string; label: string }[] = [
  { value: 'namangan', label: 'Namangan' },
  { value: 'andijon',  label: 'Andijon' },
  { value: 'fargona',  label: "Farg'ona" },
  { value: 'boshqa',   label: 'Boshqa' },
]

export const CITY_LABEL: Record<string, string> = Object.fromEntries(CITIES.map(c => [c.value, c.label]))

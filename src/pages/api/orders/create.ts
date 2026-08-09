import type { NextApiRequest, NextApiResponse } from 'next'
import { createServiceClient } from '@/lib/supabase/api'
import { getCustomer } from '@/lib/customerAuth'
import { CITIES } from '@/consts/geo'

// Create an order. Requires a logged-in customer. Re-validates every line against v_shop
// (stock + live price) as the last word before writing — the cart's snapshot is untrusted.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const customer = await getCustomer(req)
  if (!customer) return res.status(401).json({ error: 'Avval tizimga kiring' })

  const { items, city, address, contact_name, contact_phone, email, note } = req.body ?? {}
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Savat bo\'sh' })
  if (!CITIES.some(c => c.value === city)) return res.status(400).json({ error: 'Shaharni tanlang' })
  if (!address?.trim() || !contact_name?.trim() || !contact_phone?.trim())
    return res.status(400).json({ error: "Ism, telefon va manzilni to'ldiring" })

  const supabase = createServiceClient()

  // Re-validate lines against the live shop view.
  const ids = items.map((i: any) => i.id)
  const { data: shop } = await supabase.from('v_shop')
    .select('id, name, retail_price, discount_price, remaining, buyable').in('id', ids)
  const byId = new Map((shop ?? []).map((p: any) => [p.id, p]))

  const orderItems: any[] = []
  let subtotal = 0
  for (const line of items) {
    const p: any = byId.get(line.id)
    const qty = Number(line.qty)
    if (!p) return res.status(400).json({ error: `Mahsulot topilmadi`, item: line.id })
    if (!p.buyable || p.remaining <= 0) return res.status(409).json({ error: `«${p.name}» hozir mavjud emas`, item: line.id })
    if (qty <= 0 || qty > p.remaining) return res.status(409).json({ error: `«${p.name}» — faqat ${p.remaining} ta bor`, item: line.id })
    const unit_price = p.discount_price ?? p.retail_price
    subtotal += unit_price * qty
    orderItems.push({ product_id: p.id, product_name: p.name, unit_price, qty })
  }

  // Resolve the delivering seller: the city's seller, else Gulshan, else any active seller.
  const pick = async (refine: (q: any) => any) => {
    const base = supabase.from('profiles')
      .select('id, full_name, card_number, card_holder').eq('role', 'seller').eq('active', true)
    return (await refine(base).limit(1)).data?.[0]
  }
  let seller = await pick(q => q.eq('city', city))
  if (!seller) seller = await pick(q => q.ilike('full_name', '%gulshan%'))
  if (!seller) seller = await pick(q => q.order('full_name'))

  const { data: order, error } = await supabase.from('orders').insert({
    customer_id: customer.id,
    status: 'pending_payment',
    city, address: address.trim(),
    contact_name: contact_name.trim(), contact_phone: contact_phone.trim(),
    assigned_seller_id: seller?.id ?? null,
    subtotal, note: note?.trim() || null,
  }).select('id').single()
  if (error || !order) return res.status(500).json({ error: error?.message ?? 'Xatolik' })

  await supabase.from('order_items').insert(orderItems.map(i => ({ ...i, order_id: order.id })))

  // Keep the customer's contact details fresh for next time.
  await supabase.from('customers').update({
    full_name: contact_name.trim(), phone: contact_phone.trim(), email: email?.trim() || null,
  }).eq('id', customer.id)

  return res.status(200).json({
    ok: true, orderId: order.id, subtotal,
    seller: seller ? { name: seller.full_name, card_number: seller.card_number, card_holder: seller.card_holder } : null,
  })
}

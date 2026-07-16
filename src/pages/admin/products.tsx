import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS } from '@/lib/format'
import React, { useState, useRef } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import { useRouter } from 'next/router'
import AdminNav from '@/components/AdminNav'
import { Plus, Pencil, X, ImagePlus, Send, CheckCircle, Sparkles, Loader2, Link2, Crop as CropIcon, Images, GripVertical, Trash2 } from 'lucide-react'
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import { compressImage } from '@/lib/image'
// CSS imported in _app.tsx — never import CSS in page components (Next.js pages router restriction)

// A gallery image: existing rows have an id; pending uploads have id=null + a blob to upload on save.
type GalleryItem = { id: string | null; url: string; blob?: Blob }

type Product = {
  id: string
  name: string
  retail_price: number
  discount_price: number | null
  cost: number
  total_qty: number
  image_url: string | null
  description: string | null
  link: string | null
}

type FormState = {
  name: string
  retail_price: string
  discount_price: string
  cost: string
  total_qty: string
}

const EMPTY: FormState = { name: '', retail_price: '', discount_price: '', cost: '', total_qty: '' }

const fieldLabels: Record<keyof FormState, string> = {
  name: 'Nomi',
  retail_price: 'Mahsulot narx',
  discount_price: 'Chegirma narx (ixtiyoriy)',
  cost: 'Xarid narxi',
  total_qty: 'Jami soni',
}

const ASPECTS = [
  { label: 'Erkin', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
] as const

function buildCaption(name: string, retail_price: number, discount_price: number | null, desc: string | null) {
  const priceLines = discount_price != null
    ? `💰 Narxi: ${formatUZS(retail_price)}\n🏷️ Chegirma narxi: ${formatUZS(discount_price)}`
    : `💰 Narxi: ${formatUZS(retail_price)}`
  const descBlock = desc ? `\n\n${desc}` : ''
  return `✨ Yangi mahsulot!\n\n${name}\n${priceLines}${descBlock}\n\n⚠️ Mahsulot soni cheklangan!\n\n🇰🇷 Koreyadan, sinab ko'rilgan\n📍 O'zbekistonda mavjud\n\n📞 Buyurtma uchun:\n🏙 Namangan: Gulshanoy +998 94 099 44 99\n🏙 Andijon: Saida +998 93 858 27 27\n🏙 Farg'ona: Adolat +998 33 408 61 83\n\n@cameliakorea`
}

async function getCroppedBlob(img: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const scaleX = img.naturalWidth / img.width
  const scaleY = img.naturalHeight / img.height
  const canvas = document.createElement('canvas')
  canvas.width  = Math.round(crop.width  * scaleX)
  canvas.height = Math.round(crop.height * scaleY)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2d context')
  ctx.drawImage(
    img,
    Math.round(crop.x * scaleX), Math.round(crop.y * scaleY),
    Math.round(crop.width * scaleX), Math.round(crop.height * scaleY),
    0, 0,
    Math.round(crop.width * scaleX), Math.round(crop.height * scaleY),
  )
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.92)
  )
}

export default function Products({ products: initial }: { products: Product[] }) {
  const router      = useRouter()
  const fileRef     = useRef<HTMLInputElement>(null)
  const galleryRef  = useRef<HTMLInputElement>(null)
  const imgRef      = useRef<HTMLImageElement | null>(null)

  // Products list — starts from SSR data, updated client-side after saves (no navigation needed)
  const [products, setProducts] = useState<Product[]>(initial)

  // Form state
  const [editing,      setEditing]      = useState<Product | null>(null)
  const [showNew,      setShowNew]      = useState(false)
  const [form,         setForm]         = useState<FormState>(EMPTY)
  const [imageFile,    setImageFile]    = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [description,  setDescription] = useState('')
  const [descLoading,  setDescLoading] = useState(false)
  const [link,         setLink]         = useState('')
  const [linkLoading,  setLinkLoading] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  // Crop state
  const [cropSrc,       setCropSrc]       = useState<string | null>(null)
  const [crop,          setCrop]          = useState<Crop | undefined>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const [cropAspect,    setCropAspect]    = useState<number | undefined>(undefined)

  // Gallery state
  const [gallery,          setGallery]          = useState<GalleryItem[]>([])
  const [deletedGalleryIds,setDeletedGalleryIds] = useState<string[]>([])
  const [galleryBusy,      setGalleryBusy]      = useState(false)
  const [dragIndex,        setDragIndex]        = useState<number | null>(null)

  // Announce state
  const [announceId, setAnnounceId] = useState<string | null>(null)
  const [caption,    setCaption]    = useState('')
  const [posting,    setPosting]    = useState(false)
  const [postError,  setPostError]  = useState('')
  const [postedId,   setPostedId]   = useState<string | null>(null)

  const isOpen = showNew || !!editing

  // ── Form open/close ────────────────────────────────────────────────
  function openNew() {
    setShowNew(true); setEditing(null); setForm(EMPTY)
    setImageFile(null); setImagePreview(null); setDescription(''); setLink(''); setError('')
    setGallery([]); setDeletedGalleryIds([])
    closeAnnounce()
  }

  async function openEdit(p: Product) {
    setEditing(p); setShowNew(false)
    setForm({ name: p.name, retail_price: String(p.retail_price), discount_price: p.discount_price != null ? String(p.discount_price) : '', cost: String(p.cost), total_qty: String(p.total_qty) })
    setImageFile(null); setImagePreview(p.image_url)
    setDescription(p.description ?? ''); setLink(p.link ?? ''); setError('')
    setGallery([]); setDeletedGalleryIds([])
    closeAnnounce()

    // Load existing gallery rows for this product
    const supabase = createBrowser()
    const { data } = await supabase
      .from('product_images')
      .select('id, url')
      .eq('product_id', p.id)
      .order('sort_order', { ascending: true })
    if (data) setGallery(data.map(r => ({ id: r.id, url: r.url })))
  }

  function cancel() {
    // Revoke any pending object URLs to avoid leaks
    gallery.forEach(g => { if (g.id === null && g.url.startsWith('blob:')) URL.revokeObjectURL(g.url) })
    setShowNew(false); setEditing(null)
    setImageFile(null); setImagePreview(null); setDescription(''); setLink(''); setError('')
    setGallery([]); setDeletedGalleryIds([])
  }

  // ── Crop ──────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = () => { setCropSrc(reader.result as string); setCrop(undefined); setCompletedCrop(null); setCropAspect(undefined) }
    reader.readAsDataURL(file)
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget
    const aspect = cropAspect ?? width / height
    setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height), width, height))
  }

  function changeAspect(aspect: number | undefined) {
    setCropAspect(aspect)
    if (imgRef.current) {
      const { width, height } = imgRef.current
      setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect ?? width / height, width, height), width, height))
    }
  }

  async function confirmCrop() {
    if (!imgRef.current || !completedCrop) return
    const blob = await getCroppedBlob(imgRef.current, completedCrop)
    const file = new File([blob], 'product.jpg', { type: 'image/jpeg' })
    setImageFile(file)
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImagePreview(URL.createObjectURL(blob))
    setCropSrc(null)
  }

  function cancelCrop() { setCropSrc(null); setCrop(undefined); setCompletedCrop(null) }

  // ── Gallery ───────────────────────────────────────────────────────
  async function handleGalleryFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''
    setGalleryBusy(true)
    try {
      const items: GalleryItem[] = []
      for (const file of files) {
        const blob = await compressImage(file, 1080, 0.8)   // resize ≤1080px, JPEG 0.8
        items.push({ id: null, url: URL.createObjectURL(blob), blob })
      }
      setGallery(g => [...g, ...items])
    } finally {
      setGalleryBusy(false)
    }
  }

  function removeGalleryItem(index: number) {
    setGallery(g => {
      const item = g[index]
      if (item.id) setDeletedGalleryIds(ids => [...ids, item.id as string])
      if (item.id === null && item.url.startsWith('blob:')) URL.revokeObjectURL(item.url)
      return g.filter((_, i) => i !== index)
    })
  }

  function onDragStart(index: number) { setDragIndex(index) }
  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    setGallery(g => {
      const next = [...g]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(index, 0, moved)
      return next
    })
    setDragIndex(index)
  }
  function onDragEnd() { setDragIndex(null) }

  // ── AI helpers ────────────────────────────────────────────────────
  async function generateDescription() {
    if (!form.name) return
    setDescLoading(true)
    const res = await fetch('/api/generate-description', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name }) })
    const json = await res.json()
    setDescLoading(false)
    if (res.ok) setDescription(json.description)
  }

  async function findYouTube() {
    if (!form.name) return
    setLinkLoading(true)
    const res = await fetch('/api/find-youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name }) })
    const json = await res.json()
    setLinkLoading(false)
    if (res.ok && json.url) setLink(json.url)
    else if (res.ok && json.url === null) setError("YouTube'da video topilmadi — qo'lda kiriting")
  }

  // ── Announce ──────────────────────────────────────────────────────
  function openAnnounce(p: Product) {
    cancel()
    setAnnounceId(p.id)
    setCaption(buildCaption(p.name, p.retail_price, p.discount_price, p.description))
    setPostError(''); setPostedId(null)
  }
  function closeAnnounce() { setAnnounceId(null); setCaption(''); setPostError('') }

  async function post(p: Product) {
    if (!p.image_url) return
    setPosting(true); setPostError('')
    const res = await fetch('/api/announce', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_url: p.image_url, caption, link: p.link }) })
    const json = await res.json()
    setPosting(false)
    if (!res.ok) { setPostError(json.error ?? 'Xatolik yuz berdi'); return }
    setPostedId(p.id); closeAnnounce()
  }

  // ── Save — refreshes product list client-side, no navigation ─────
  async function save() {
    setLoading(true); setError('')
    const supabase = createBrowser()
    const payload = {
      name: form.name,
      retail_price: Number(form.retail_price),
      discount_price: form.discount_price !== '' ? Number(form.discount_price) : null,
      cost: Number(form.cost),
      total_qty: Number(form.total_qty),
      description: description || null,
      link: link || null,
    }

    let productId: string
    if (editing) {
      productId = editing.id
      const { error: err } = await supabase.from('products').update(payload).eq('id', editing.id)
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      const { data, error: err } = await supabase.from('products').insert(payload).select('id').single()
      if (err || !data) { setError(err?.message ?? 'Xatolik'); setLoading(false); return }
      productId = data.id
    }

    if (imageFile) {
      const path = `${productId}.jpg`
      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(path, imageFile, { upsert: true, cacheControl: '0' })
      if (uploadErr) { setError(`Rasm yuklashda xatolik: ${uploadErr.message}`); setLoading(false); return }
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path)
      const urlWithBust = `${urlData.publicUrl}?v=${new Date().getTime()}`
      await supabase.from('products').update({ image_url: urlWithBust }).eq('id', productId)
    }

    // ── Gallery sync ──
    // 1. Delete removed rows
    if (deletedGalleryIds.length) {
      await supabase.from('product_images').delete().in('id', deletedGalleryIds)
    }
    // 2. Upload new blobs + insert rows; 3. update sort_order to match current order
    for (let i = 0; i < gallery.length; i++) {
      const item = gallery[i]
      if (item.id === null && item.blob) {
        const gpath = `gallery/${productId}-${new Date().getTime()}-${i}.jpg`
        const { error: gErr } = await supabase.storage
          .from('product-images')
          .upload(gpath, item.blob, { upsert: true, cacheControl: '3600' })
        if (gErr) { setError(`Galereya yuklashda xatolik: ${gErr.message}`); setLoading(false); return }
        const { data: gUrl } = supabase.storage.from('product-images').getPublicUrl(gpath)
        await supabase.from('product_images').insert({ product_id: productId, url: gUrl.publicUrl, sort_order: i })
      } else if (item.id) {
        await supabase.from('product_images').update({ sort_order: i }).eq('id', item.id)
      }
    }

    // Re-fetch product list client-side — no router.replace needed
    const { data: refreshed } = await supabase.from('products').select('*').order('name')
    if (refreshed) setProducts(refreshed)

    setLoading(false)
    cancel()
  }

  // ── Form JSX (shared between new + edit) ─────────────────────────
  const formBody = (
    <>
      <div className="grid grid-cols-2 gap-5 items-start">
        {/* Text fields */}
        <div className="col-span-2 md:col-span-1 space-y-4">
          {(Object.keys(EMPTY) as (keyof FormState)[]).map(key => (
            <div key={key}>
              <label className="block text-sm font-medium text-muted mb-1">{fieldLabels[key]}</label>
              <input
                type={key === 'name' ? 'text' : 'number'}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={key === 'discount_price' ? "Bo'sh qoldiring" : ''}
                className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition"
              />
            </div>
          ))}
        </div>

        {/* Image upload */}
        <div className="col-span-2 md:col-span-1">
          <label className="block text-sm font-medium text-muted mb-2">Rasm</label>
          <div onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-2xl border-2 border-dashed border-rose/30 hover:border-rose/60 transition overflow-hidden bg-cream flex items-center justify-center"
            style={{ minHeight: '200px' }}>
            {imagePreview ? (
              <img src={imagePreview} alt="preview" className="w-full h-full object-cover" style={{ maxHeight: '260px' }} />
            ) : (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-rose/10 flex items-center justify-center">
                  <ImagePlus className="w-6 h-6 text-rose" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">Rasm yuklash</p>
                  <p className="text-xs text-muted mt-0.5">JPG, PNG · bosing</p>
                </div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          {imagePreview && (
            <div className="flex gap-3 mt-2">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="text-xs text-rose hover:text-roseDark transition flex items-center gap-1">
                <CropIcon className="w-3.5 h-3.5" /> Boshqa rasm / qayta kesish
              </button>
              <button type="button" onClick={() => { setImageFile(null); setImagePreview(editing?.image_url ?? null) }}
                className="text-xs text-muted hover:text-danger transition">
                Olib tashlash
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-muted">Tavsif</label>
          <button type="button" onClick={generateDescription} disabled={descLoading || !form.name}
            className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-br from-lavender to-sky text-white px-3 py-1.5 rounded-full active:scale-95 transition disabled:opacity-50 shadow-sm">
            {descLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Yozilmoqda…</> : <><Sparkles className="w-3.5 h-3.5" /> AI bilan yozish</>}
          </button>
        </div>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
          placeholder="Mahsulot haqida qisqacha tavsif…"
          className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-lavender border-2 border-transparent transition resize-none" />
      </div>

      {/* YouTube link */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-muted">Video link (YouTube)</label>
          <button type="button" onClick={findYouTube} disabled={linkLoading || !form.name}
            className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-br from-rose/80 to-peach text-white px-3 py-1.5 rounded-full active:scale-95 transition disabled:opacity-50 shadow-sm">
            {linkLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Qidirilmoqda…</> : <><Link2 className="w-3.5 h-3.5" /> YouTube link topish</>}
          </button>
        </div>
        <input type="url" value={link} onChange={e => setLink(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer"
            className="text-xs text-sky hover:underline mt-1 inline-block truncate max-w-full">{link}</a>
        )}
      </div>

      {/* Gallery — result photos */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-muted flex items-center gap-1.5">
            <Images className="w-4 h-4" /> Natija rasmlari
          </label>
          <button type="button" onClick={() => galleryRef.current?.click()} disabled={galleryBusy}
            className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-br from-mint to-sky text-white px-3 py-1.5 rounded-full active:scale-95 transition disabled:opacity-50 shadow-sm">
            {galleryBusy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Qayta ishlanmoqda…</> : <><Plus className="w-3.5 h-3.5" /> Rasm qo'shish</>}
          </button>
        </div>
        <input ref={galleryRef} type="file" accept="image/*" multiple onChange={handleGalleryFiles} className="hidden" />

        {gallery.length === 0 ? (
          <p className="text-xs text-muted bg-cream rounded-xl px-4 py-3">
            Bir nechta rasm qo'shing. Surib tartibini o'zgartiring.
          </p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {gallery.map((g, i) => (
              <div
                key={g.id ?? g.url}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={e => onDragOver(e, i)}
                onDragEnd={onDragEnd}
                className={`relative group rounded-xl overflow-hidden border-2 transition cursor-grab active:cursor-grabbing ${dragIndex === i ? 'border-rose opacity-60' : 'border-transparent'}`}
              >
                <img src={g.url} alt="" loading="lazy" className="w-full h-20 object-cover" />
                <div className="absolute top-1 left-1 bg-black/40 rounded p-0.5">
                  <GripVertical className="w-3 h-3 text-white" />
                </div>
                <button type="button" onClick={() => removeGalleryItem(i)}
                  className="absolute top-1 right-1 bg-danger text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition">
                  <Trash2 className="w-3 h-3" />
                </button>
                <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">{i + 1}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-6 max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold text-ink text-2xl">Mahsulotlar</h2>
          <button onClick={openNew}
            className="flex items-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-semibold px-5 py-2.5 rounded-full shadow-rose active:scale-95 transition text-sm">
            <Plus className="w-4 h-4" /> Yangi mahsulot
          </button>
        </div>

        {/* ── Table ── always visible ── */}
        <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-4 font-semibold text-muted w-12"></th>
                <th className="text-left px-5 py-4 font-semibold text-muted">Nomi</th>
                <th className="text-right px-4 py-4 font-semibold text-muted">Retail</th>
                <th className="text-right px-4 py-4 font-semibold text-muted">Chegirma</th>
                <th className="text-right px-4 py-4 font-semibold text-muted">Xarid</th>
                <th className="text-right px-4 py-4 font-semibold text-muted">Soni</th>
                <th className="px-4 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <React.Fragment key={p.id}>
                  <tr className={`${i % 2 === 1 ? 'bg-cream/50' : ''} hover:bg-rose/5 transition`}>
                    <td className="px-5 py-3">
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover shadow-sm" />
                        : <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose/20 to-peach/20 flex items-center justify-center">
                            <span className="font-display font-bold text-rose text-sm">{p.name.charAt(0)}</span>
                          </div>
                      }
                    </td>
                    <td className="px-5 py-3 font-medium text-ink">{p.name}</td>
                    <td className="px-4 py-3 text-right text-ink">{formatUZS(p.retail_price)}</td>
                    <td className="px-4 py-3 text-right text-muted">{p.discount_price != null ? formatUZS(p.discount_price) : '—'}</td>
                    <td className="px-4 py-3 text-right text-muted">{formatUZS(p.cost)}</td>
                    <td className="px-4 py-3 text-right font-display font-bold text-ink">{p.total_qty}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {postedId === p.id && (
                          <span className="flex items-center gap-1 text-xs text-success font-semibold">
                            <CheckCircle className="w-3.5 h-3.5" /> Posted
                          </span>
                        )}
                        {p.image_url && announceId !== p.id && postedId !== p.id && (
                          <button onClick={() => openAnnounce(p)} title="Post to Camelia Store"
                            className="text-xs flex items-center gap-1 text-muted hover:text-rose transition font-medium px-2 py-1 rounded-lg hover:bg-rose/5">
                            📢 Post
                          </button>
                        )}
                        <button onClick={() => openEdit(p)} className="text-rose hover:text-roseDark transition">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Announce panel */}
                  {announceId === p.id && (
                    <tr>
                      <td colSpan={7} className="px-5 pb-4 pt-0">
                        <div className="bg-gradient-to-br from-sky/10 to-lavender/10 border border-lavender/30 rounded-2xl p-5">
                          <div className="flex items-center justify-between mb-3">
                            <p className="font-display font-semibold text-ink text-sm">📢 Post to Camelia Store</p>
                            <button onClick={closeAnnounce} className="text-muted hover:text-ink transition"><X className="w-4 h-4" /></button>
                          </div>
                          {p.image_url && <img src={p.image_url} alt={p.name} className="w-24 h-24 rounded-xl object-cover shadow-sm mb-3" />}
                          <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={9}
                            className="w-full bg-surface text-ink rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-lavender border-2 border-transparent transition resize-none" />
                          {postError && <p className="text-danger text-xs mt-2">{postError}</p>}
                          <div className="flex gap-3 mt-3">
                            <button onClick={() => post(p)} disabled={posting || !caption.trim()}
                              className="flex items-center gap-2 bg-gradient-to-br from-sky to-lavender text-white font-semibold px-5 py-2.5 rounded-full active:scale-95 transition disabled:opacity-50 text-sm shadow-sm">
                              <Send className="w-4 h-4" />
                              {posting ? 'Yuborilmoqda…' : 'Kanalga yuborish'}
                            </button>
                            <button onClick={closeAnnounce} className="text-muted hover:text-ink text-sm px-4 py-2 transition">Bekor qilish</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* ── Edit / Create MODAL ── z-40, below crop modal ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) cancel() }}
        >
          <div className="bg-surface rounded-2xl shadow-card w-full max-w-3xl max-h-[92vh] flex flex-col">

            {/* Sticky header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0 sticky top-0 bg-surface rounded-t-2xl z-10">
              <h3 className="font-display font-bold text-ink text-xl">
                {editing ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
              </h3>
              <button onClick={cancel} className="text-muted hover:text-ink transition p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {formBody}
              {error && <p className="text-danger text-sm mt-4">{error}</p>}
            </div>

            {/* Sticky footer */}
            <div className="flex gap-3 px-6 py-5 border-t border-gray-100 flex-shrink-0">
              <button onClick={save} disabled={loading || !form.name}
                className="bg-gradient-to-br from-rose to-peach text-white font-semibold px-6 py-2.5 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50 text-sm">
                {loading ? 'Saqlanmoqda…' : 'Saqlash'}
              </button>
              <button onClick={cancel} className="text-muted hover:text-ink text-sm px-4 py-2.5 transition">
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Crop modal ── z-50, above edit modal ── */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface rounded-2xl shadow-card p-6 w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="font-display font-bold text-ink text-lg flex items-center gap-2">
                <CropIcon className="w-5 h-5 text-rose" /> Rasmni kesish
              </h3>
              <button onClick={cancelCrop} className="text-muted hover:text-ink transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex gap-2 mb-4 flex-shrink-0">
              {ASPECTS.map(({ label, value }) => (
                <button key={label} onClick={() => changeAspect(value)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${cropAspect === value ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'bg-cream text-ink hover:bg-rose/10'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center min-h-0">
              <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)}
                aspect={cropAspect} minWidth={40} minHeight={40}>
                <img ref={imgRef} src={cropSrc} onLoad={onImageLoad} alt="crop"
                  style={{ maxHeight: '55vh', maxWidth: '100%', display: 'block' }} />
              </ReactCrop>
            </div>
            <div className="flex gap-3 mt-4 flex-shrink-0">
              <button onClick={confirmCrop} disabled={!completedCrop}
                className="bg-gradient-to-br from-rose to-peach text-white font-display font-semibold px-6 py-2.5 rounded-full shadow-rose active:scale-95 transition disabled:opacity-40">
                Kesib olish ✂️
              </button>
              <button onClick={cancelCrop} className="text-muted hover:text-ink text-sm px-4 py-2.5 transition">Bekor qilish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'admin')
  if (guard) return guard
  const supabase = createClient(ctx)
  const { data: products } = await supabase.from('products').select('*').order('name')
  return { props: { products: products ?? [] } }
}

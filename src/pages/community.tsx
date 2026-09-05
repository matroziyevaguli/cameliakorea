import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { createPublicClient } from '@/lib/supabase/api'
import { TOPICS, TOPIC_LABEL } from '@/consts/community'
import { ArrowLeft, MessageCircleQuestion, Send, X, Loader2, CheckCircle } from 'lucide-react'

type QA = { id: string; name: string | null; question: string; answer: string; topic: string | null; answered_at: string | null }

export default function Community({ items }: { items: QA[] }) {
  const router = useRouter()
  const [ask, setAsk] = useState(false)
  const [topic, setTopic] = useState('')          // filter
  const [filterTopic, setFilterTopic] = useState('')

  // Instagram deep link → /community?ask=1 opens the modal.
  useEffect(() => { if (router.query.ask) setAsk(true) }, [router.query.ask])

  // Ask form
  const [form, setForm] = useState({ name: '', topic: '', question: '' })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    if (form.question.trim().length < 5) { setError('Savolingizni yozing (kamida 5 ta belgi).'); return }
    setBusy(true)
    const res = await fetch('/api/community/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(j.error ?? 'Xatolik'); return }
    setSent(true); setForm({ name: '', topic: '', question: '' })
  }
  function closeAsk() { setAsk(false); setSent(false); setError(''); if (router.query.ask) router.replace('/community', undefined, { shallow: true }) }

  const shown = useMemo(
    () => filterTopic ? items.filter(i => i.topic === filterTopic) : items,
    [items, filterTopic]
  )
  const usedTopics = TOPICS.filter(t => items.some(i => i.topic === t.value))

  return (
    <>
      <Head><title>Savol-javob — Camelia</title>
        <meta name="description" content="Menga savol bering — Koreya, til o'rganish, dasturchilik yoki qanday kontent xohlaysiz. Savol-javob." />
      </Head>
      <div className="min-h-screen bg-cream">
        <header className="sticky top-0 z-20 bg-cream/80 backdrop-blur border-b border-black/5">
          <div className="max-w-2xl mx-auto px-5 h-16 flex items-center gap-3">
            <Link href="/" className="text-muted hover:text-ink transition"><ArrowLeft className="w-5 h-5" /></Link>
            <h1 className="font-display font-bold text-ink text-lg">Savol-javob</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8">
          {/* Intro + CTA */}
          <div className="bg-gradient-to-br from-rose to-peach text-white rounded-3xl p-6 md:p-8 mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/4" />
            <h2 className="font-display font-bold text-2xl md:text-3xl relative">Menga savol bering</h2>
            <p className="text-white/90 mt-2 relative max-w-md">
              Koreya, til o'rganish, dasturchilik, Koreyada ishlash yoki mendan qanday kontent
              xohlaysiz — yozing. Javoblarni shu yerda hamma ko'radi.
            </p>
            <button onClick={() => setAsk(true)}
              className="relative mt-5 inline-flex items-center gap-2 bg-white text-rose font-display font-bold px-6 py-3 rounded-full active:scale-95 transition">
              <MessageCircleQuestion className="w-5 h-5" /> Savol berish
            </button>
          </div>

          {/* Topic filter */}
          {usedTopics.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              <button onClick={() => setFilterTopic('')}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${filterTopic === '' ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'bg-surface text-muted shadow-card hover:text-ink'}`}>Hammasi</button>
              {usedTopics.map(t => (
                <button key={t.value} onClick={() => setFilterTopic(t.value)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${filterTopic === t.value ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'bg-surface text-muted shadow-card hover:text-ink'}`}>{t.label}</button>
              ))}
            </div>
          )}

          {/* Q&A list */}
          {shown.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card p-10 text-center">
              <MessageCircleQuestion className="w-8 h-8 text-muted mx-auto mb-2" />
              <p className="text-muted">Hozircha savol-javob yo'q. Birinchi bo'lib so'rang!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {shown.map(qa => (
                <div key={qa.id} className="bg-surface rounded-2xl shadow-card p-5">
                  <div className="flex items-center gap-2 mb-2">
                    {qa.topic && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-lavender/15 text-lavender">{TOPIC_LABEL[qa.topic] ?? qa.topic}</span>}
                    <span className="text-xs text-muted">{qa.name || 'Anonim'}</span>
                  </div>
                  <p className="font-semibold text-ink">{qa.question}</p>
                  <div className="mt-3 pl-3 border-l-2 border-rose/40">
                    <p className="text-xs font-semibold text-rose mb-0.5">Camelia javobi</p>
                    <p className="text-ink/90 whitespace-pre-line leading-relaxed">{qa.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Ask modal */}
        {ask && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={closeAsk} />
            <div className="relative bg-surface rounded-2xl shadow-card w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display font-bold text-ink text-xl">Savol berish</h3>
                <button aria-label="Yopish" onClick={closeAsk} className="text-muted hover:text-ink transition"><X className="w-5 h-5" /></button>
              </div>
              {sent ? (
                <div className="text-center py-6">
                  <CheckCircle className="w-10 h-10 text-success mx-auto mb-3" />
                  <p className="font-semibold text-ink">Rahmat! Savolingiz ko'rib chiqiladi.</p>
                  <p className="text-sm text-muted mt-1">Javob berilgach, shu sahifada paydo bo'ladi.</p>
                  <button onClick={closeAsk} className="mt-5 bg-cream text-ink font-semibold px-6 py-2.5 rounded-full active:scale-95 transition">Yopish</button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted mb-4">Nima so'ramoqchisiz yoki qanday kontent xohlaysiz?</p>
                  <div className="space-y-3">
                    <textarea value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} rows={4}
                      placeholder="Savolingiz…" autoFocus
                      className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition resize-none" />
                    <div className="grid grid-cols-2 gap-3">
                      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Ismingiz (ixtiyoriy)"
                        className="bg-cream text-ink rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
                      <select value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                        className="bg-cream text-ink rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition">
                        <option value="">Mavzu (ixtiyoriy)</option>
                        {TOPICS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    {error && <p className="text-danger text-sm">{error}</p>}
                    <button onClick={submit} disabled={busy}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-3.5 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50">
                      {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Yuborilmoqda…</> : <><Send className="w-5 h-5" /> Yuborish</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async () => {
  let items: QA[] = []
  try {
    const pub = createPublicClient()
    const { data } = await pub.from('community_questions')
      .select('id, name, question, answer, topic, answered_at')
      .eq('status', 'answered')
      .order('answered_at', { ascending: false })
    items = (data as QA[]) ?? []
  } catch { /* table may not exist yet → empty state */ }
  return { props: { items } }
}

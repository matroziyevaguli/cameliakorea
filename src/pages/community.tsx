import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { createPublicClient } from '@/lib/supabase/api'
import { TOPICS } from '@/consts/community'
import { useT } from '@/i18n'
import LangSwitcher from '@/components/LangSwitcher'
import { ArrowLeft, MessageCircleQuestion, Send, X, Loader2, Copy, Check, Tag, User } from 'lucide-react'

type QA = { id: string; name: string | null; question: string; answer: string; topic: string | null; answered_at: string | null }

// One-tap starters (chip/question come from the dictionary) so the blank page never intimidates.
const EXAMPLES = [
  { chipKey: 'comm.ex1.chip', qKey: 'comm.ex1.q', topic: 'koreys_tili' },
  { chipKey: 'comm.ex2.chip', qKey: 'comm.ex2.q', topic: 'koreya' },
  { chipKey: 'comm.ex3.chip', qKey: 'comm.ex3.q', topic: 'dasturchilik' },
  { chipKey: 'comm.ex4.chip', qKey: 'comm.ex4.q', topic: 'boshqa' },
]

export default function Community({ items }: { items: QA[] }) {
  const t = useT()
  const router = useRouter()
  const [ask, setAsk] = useState(false)
  const [filterTopic, setFilterTopic] = useState('')

  // Instagram deep link → /community?ask=1 opens the modal.
  useEffect(() => { if (router.query.ask) setAsk(true) }, [router.query.ask])

  // Ask form
  const [form, setForm] = useState({ name: '', topic: '', question: '' })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/community` : 'cameliakorea.com/community'
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked */ }
  }

  async function submit() {
    setError('')
    if (form.question.trim().length < 5) { setError(t('comm.errShort')); return }
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
  const usedTopics = TOPICS.filter(tp => items.some(i => i.topic === tp.value))

  return (
    <>
      <Head><title>{t('comm.metaTitle')}</title>
        <meta name="description" content={t('comm.metaDesc')} />
      </Head>
      <div className="min-h-screen bg-cream">
        <header className="sticky top-0 z-20 bg-cream/80 backdrop-blur border-b border-black/5">
          <div className="max-w-2xl mx-auto px-5 h-16 flex items-center gap-3">
            <Link href="/" className="text-muted hover:text-ink transition"><ArrowLeft className="w-5 h-5" /></Link>
            <h1 className="font-display font-bold text-ink text-lg">{t('nav.qa')}</h1>
            <div className="ml-auto"><LangSwitcher /></div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8">
          {/* Intro + CTA */}
          <div className="bg-gradient-to-br from-rose to-peach text-white rounded-3xl p-6 md:p-8 mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/4" />
            <h2 className="font-display font-bold text-2xl md:text-3xl relative">{t('comm.heroTitle')}</h2>
            <p className="text-white/90 mt-2 relative max-w-md">{t('comm.heroBody')}</p>
            <button onClick={() => setAsk(true)}
              className="relative mt-5 inline-flex items-center gap-2 bg-white text-rose font-display font-bold px-6 py-3 rounded-full active:scale-95 transition">
              <MessageCircleQuestion className="w-5 h-5" /> {t('comm.ask')}
            </button>
          </div>

          {/* Topic filter */}
          {usedTopics.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              <button onClick={() => setFilterTopic('')}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${filterTopic === '' ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'bg-surface text-muted shadow-card hover:text-ink'}`}>{t('home.all')}</button>
              {usedTopics.map(tp => (
                <button key={tp.value} onClick={() => setFilterTopic(tp.value)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${filterTopic === tp.value ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'bg-surface text-muted shadow-card hover:text-ink'}`}>{t(`topic.${tp.value}`)}</button>
              ))}
            </div>
          )}

          {/* Q&A list */}
          {shown.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card p-10 text-center">
              <MessageCircleQuestion className="w-8 h-8 text-muted mx-auto mb-2" />
              <p className="text-muted">{t('comm.empty')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {shown.map(qa => (
                <div key={qa.id} className="bg-surface rounded-2xl shadow-card p-5">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {qa.topic && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-lavender/20 text-lavender">
                        <Tag className="w-3 h-3" /> {t(`topic.${qa.topic}`)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <User className="w-3.5 h-3.5" /> {qa.name || t('common.anonim')}
                    </span>
                  </div>
                  <p className="font-semibold text-ink">{qa.question}</p>
                  <div className="mt-3 pl-3 border-l-2 border-rose/40">
                    <p className="text-xs font-semibold text-rose mb-0.5">{t('comm.answerLabel')}</p>
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
            <div className="relative bg-surface rounded-3xl shadow-card w-full max-w-md overflow-hidden max-h-[92vh] overflow-y-auto">
              {/* Cute gradient header */}
              <div className="relative bg-gradient-to-br from-rose via-peach to-lavender text-white px-6 pt-7 pb-10 text-center">
                <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/15 rounded-full" />
                <div className="absolute -bottom-8 -left-4 w-24 h-24 bg-white/10 rounded-full" />
                <button aria-label={t('common.close')} onClick={closeAsk} className="absolute top-4 right-4 text-white/80 hover:text-white transition z-10"><X className="w-5 h-5" /></button>
                <div className="text-5xl mb-1 relative">💌</div>
                <h3 className="font-display font-bold text-2xl relative">{t('comm.modalTitle')}</h3>
                <p className="text-white/90 text-sm mt-1 max-w-xs mx-auto relative">{t('comm.modalSub')}</p>
              </div>

              <div className="px-6 py-5 -mt-5 bg-surface rounded-t-3xl relative">
                {sent ? (
                  <div className="text-center py-4">
                    <div className="text-5xl mb-3">🌷</div>
                    <p className="font-display font-bold text-ink text-lg">{t('comm.thanks')}</p>
                    <p className="text-sm text-muted mt-1">{t('comm.answerHere')}</p>
                    <div className="mt-3 flex items-center gap-2 bg-cream rounded-xl pl-3 pr-1.5 py-1.5">
                      <span className="text-sm text-ink truncate flex-1 text-left">{shareUrl}</span>
                      <button onClick={copyLink}
                        className={`flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-lg active:scale-95 transition flex-shrink-0 ${copied ? 'text-success' : 'text-white bg-gradient-to-br from-rose to-peach'}`}>
                        {copied ? <><Check className="w-4 h-4" /> {t('order.copied')}</> : <><Copy className="w-4 h-4" /> {t('comm.copy')}</>}
                      </button>
                    </div>
                    <button onClick={closeAsk} className="mt-4 bg-cream text-ink font-semibold px-6 py-2.5 rounded-full active:scale-95 transition">{t('comm.viewQA')}</button>
                  </div>
                ) : (
                  <>
                    {/* What you can write */}
                    <div className="bg-cream/70 rounded-2xl p-4 mb-4">
                      <p className="text-sm font-semibold text-ink mb-1">{t('comm.whatTitle')}</p>
                      <p className="text-xs text-muted leading-relaxed">{t('comm.whatBody')}</p>
                    </div>

                    {/* One-tap starters */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {EXAMPLES.map((ex, i) => (
                        <button key={i} type="button" onClick={() => setForm(f => ({ ...f, question: t(ex.qKey), topic: ex.topic }))}
                          className="text-xs font-medium bg-white text-rose border border-rose/20 rounded-full px-3 py-1.5 hover:bg-rose/5 active:scale-95 transition">
                          {t(ex.chipKey)}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <textarea value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value.slice(0, 1000) }))} rows={4}
                          placeholder={t('comm.qPlaceholder')} autoFocus
                          className="w-full bg-cream text-ink rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition resize-none" />
                        <p className="text-[11px] text-muted text-right mt-1">{form.question.length}/1000</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          placeholder={t('comm.namePh')}
                          className="bg-cream text-ink rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
                        <select value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                          className="bg-cream text-ink rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition">
                          <option value="">{t('comm.topicPh')}</option>
                          {TOPICS.map(tp => <option key={tp.value} value={tp.value}>{t(`topic.${tp.value}`)}</option>)}
                        </select>
                      </div>
                      {error && <p className="text-danger text-sm">{error}</p>}
                      <button onClick={submit} disabled={busy}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-3.5 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50">
                        {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> {t('common.sending')}</> : <><Send className="w-5 h-5" /> {t('comm.send')}</>}
                      </button>
                      <p className="text-[11px] text-muted text-center">{t('comm.anonNote')}</p>
                    </div>
                  </>
                )}
              </div>
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

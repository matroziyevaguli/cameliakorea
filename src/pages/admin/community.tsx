import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { requireRole } from '@/lib/guards'
import { createServiceClient } from '@/lib/supabase/api'
import AdminNav from '@/components/AdminNav'
import { formatDate } from '@/lib/format'
import { useT } from '@/i18n'
import { Send, EyeOff, Eye, Trash2, Loader2 } from 'lucide-react'

type Q = { id: string; name: string | null; question: string; answer: string | null; topic: string | null; status: string; created_at: string }

const TABS = [
  { key: 'pending',  labelKey: 'acomm.tab_new' },
  { key: 'answered', labelKey: 'acomm.tab_answered' },
  { key: 'hidden',   labelKey: 'acomm.tab_hidden' },
]

export default function AdminCommunity({ questions }: { questions: Q[] }) {
  const t = useT()
  const router = useRouter()
  const [tab, setTab] = useState('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  const shown = questions.filter(q => q.status === tab)

  async function act(id: string, action: string, answer?: string) {
    setBusyId(id); setError('')
    const res = await fetch('/api/admin/community', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, answer }),
    })
    const j = await res.json().catch(() => ({}))
    setBusyId(null)
    if (!res.ok) { setError(j.error ?? t('common.error')); return }
    router.replace(router.asPath)
  }

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-4 md:p-6 max-w-3xl mx-auto">
        <h2 className="font-display font-bold text-ink text-2xl mb-5">{t('nav.qa')}</h2>

        <div className="flex gap-2 mb-5">
          {TABS.map(tabItem => {
            const n = questions.filter(q => q.status === tabItem.key).length
            return (
              <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${tab === tabItem.key ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'bg-surface text-muted hover:text-ink'}`}>
                {t(tabItem.labelKey)}{n > 0 && <span className="ml-1.5 opacity-80">{n}</span>}
              </button>
            )
          })}
        </div>

        {error && <p className="text-danger text-sm mb-4 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

        {shown.length === 0 ? (
          <div className="bg-surface rounded-2xl shadow-card p-8 text-center text-muted">{t('acomm.empty')}</div>
        ) : (
          <div className="space-y-4">
            {shown.map(q => (
              <div key={q.id} className="bg-surface rounded-2xl shadow-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  {q.topic && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-lavender/15 text-lavender">{t(`topic.${q.topic}`)}</span>}
                  <span className="text-xs text-muted">{q.name || t('common.anonim')} · {formatDate(q.created_at)}</span>
                </div>
                <p className="font-semibold text-ink mb-3">{q.question}</p>

                {q.status !== 'hidden' && (
                  <textarea
                    value={drafts[q.id] ?? q.answer ?? ''}
                    onChange={e => setDrafts(d => ({ ...d, [q.id]: e.target.value }))}
                    rows={3} placeholder={t('acomm.answer_ph')}
                    className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition resize-none mb-3" />
                )}

                <div className="flex flex-wrap gap-2 items-center">
                  {busyId === q.id && <span className="flex items-center gap-1.5 text-sm text-muted"><Loader2 className="w-4 h-4 animate-spin" /> …</span>}
                  {q.status !== 'hidden' && (
                    <button onClick={() => act(q.id, 'answer', drafts[q.id] ?? q.answer ?? '')} disabled={busyId === q.id}
                      className="flex items-center gap-1.5 bg-gradient-to-br from-mint to-success text-white text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition disabled:opacity-50">
                      <Send className="w-4 h-4" /> {q.status === 'answered' ? t('acomm.update_answer') : t('acomm.answer')}
                    </button>
                  )}
                  {q.status === 'hidden' ? (
                    <button onClick={() => act(q.id, 'unhide')} disabled={busyId === q.id}
                      className="flex items-center gap-1.5 bg-cream text-ink text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition disabled:opacity-50">
                      <Eye className="w-4 h-4" /> {t('acomm.restore')}
                    </button>
                  ) : (
                    <button onClick={() => act(q.id, 'hide')} disabled={busyId === q.id}
                      className="flex items-center gap-1.5 bg-cream text-muted text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition disabled:opacity-50">
                      <EyeOff className="w-4 h-4" /> {t('acomm.hide')}
                    </button>
                  )}
                  <button onClick={() => act(q.id, 'delete')} disabled={busyId === q.id}
                    className="flex items-center gap-1.5 text-danger text-sm font-semibold px-3 py-2 rounded-lg hover:bg-red-50 transition disabled:opacity-50">
                    <Trash2 className="w-4 h-4" /> {t('common.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'admin')
  if (guard) return guard
  const supabase = createServiceClient()
  const { data } = await supabase.from('community_questions')
    .select('id, name, question, answer, topic, status, created_at')
    .order('created_at', { ascending: false })
  return { props: { questions: data ?? [] } }
}

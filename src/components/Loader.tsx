import { useEffect, useState } from 'react'
import Router from 'next/router'

// Cute three-dot bouncing spinner in the brand colors. Use inline for buttons/sections.
export function Spinner({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-rose animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2.5 h-2.5 rounded-full bg-peach animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2.5 h-2.5 rounded-full bg-lavender animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      {label && <p className="text-sm text-muted">{label}</p>}
    </div>
  )
}

// Small inline spinner (rotating ring) for button labels.
export function MiniSpinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin ${className}`} />
}

// Global top progress bar — shows on EVERY page navigation (getServerSideProps fetch).
// Mount once in _app.tsx. Also shows a tiny corner spinner so it's obvious something's happening.
export function RouteProgress() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const start = () => { timer = setTimeout(() => setActive(true), 80) } // skip flash on instant nav
    const done = () => { clearTimeout(timer); setActive(false) }
    Router.events.on('routeChangeStart', start)
    Router.events.on('routeChangeComplete', done)
    Router.events.on('routeChangeError', done)
    return () => {
      clearTimeout(timer)
      Router.events.off('routeChangeStart', start)
      Router.events.off('routeChangeComplete', done)
      Router.events.off('routeChangeError', done)
    }
  }, [])

  if (!active) return null
  return (
    <>
      {/* top sliding bar */}
      <div className="fixed top-0 inset-x-0 h-1 z-[200] bg-rose/10 overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-rose via-peach to-lavender route-progress-bar" />
      </div>
      {/* corner pill so it's clearly loading */}
      <div className="fixed top-3 right-3 z-[200] flex items-center gap-2 bg-white/95 backdrop-blur shadow-card rounded-full pl-2 pr-3 py-1.5">
        <span className="inline-block w-4 h-4 rounded-full border-2 border-rose/30 border-t-rose animate-spin" />
        <span className="text-xs font-semibold text-ink">Yuklanmoqda…</span>
      </div>
    </>
  )
}

import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { PROJECTS_LIST } from '@/consts'
import { useRouter } from 'next/router'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { localizeProject, useI18n } from '@/lib/i18n'

export default function ProjectDetail() {
  const router = useRouter()
  const { locale, t } = useI18n()
  const sourceProject = PROJECTS_LIST.find((item) => item.id === Number(router.query.id))
  const project = sourceProject ? localizeProject(sourceProject, locale) : undefined

  if (!project) return <div className="archive-shell">{t.loading}</div>

  return (
    <>
      <Head>
        <title>{project.title} — Gulchiroy Matroziyeva</title>
        <meta name="description" content={project.description || `A project by Gulchiroy Matroziyeva: ${project.title}.`} />
      </Head>
      <main className="archive-shell">
        <nav className="archive-nav">
          <Link href="/careers/owner/archive"><ArrowLeft size={17} /> {t.allProjects}</Link>
          <LanguageSwitcher />
          <Link href="/careers/owner/portfolio">GM / {t.home}</Link>
        </nav>
        <header className="case-hero">
          <p className="eyebrow">{t.caseStudy} / {project.start_at.slice(0, 4)}</p>
          <h1>{project.title}</h1>
          <div className="case-summary">
            <div>
              <div className="case-meta">
                <div><span>{t.timeline}</span>{project.start_at} — {project.end_at}</div>
                <div><span>{t.madeAt}</span>{project.made_at || t.independent}</div>
              </div>
              <div className="tag-list" style={{ marginTop: 28 }}>
                {project.stacks.map((stack) => <span key={stack}>{stack}</span>)}
              </div>
              <div className="case-actions">
                {project.link && <a href={project.link} target="_blank" rel="noreferrer">{t.visit} <ArrowUpRight size={16} /></a>}
              </div>
            </div>
            <p>{project.description || 'A cross-platform product shaped around a clear, dependable user experience and maintainable engineering.'}</p>
          </div>
        </header>
        <section className="gallery" aria-label={`${project.title} ${t.gallery}`}>
          {project.image.length ? project.image.map((image, index) => (
            <figure className="gallery-item" key={`${image.uri}-${index}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.uri} alt={`${project.title} ${index + 1}`} loading="lazy" />
            </figure>
          )) : <div className="empty-gallery">{t.comingSoon}</div>}
        </section>
      </main>
    </>
  )
}

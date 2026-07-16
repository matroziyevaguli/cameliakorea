import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { PROJECTS_LIST } from '@/consts'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { localizeProject, useI18n } from '@/lib/i18n'

const parseDate = (date: string) => new Date(...(date.split('.').map(Number) as [number, number])).getTime()

export default function Archive() {
  const { locale, t } = useI18n()
  const projects = [...PROJECTS_LIST].sort((a, b) => parseDate(b.start_at) - parseDate(a.start_at)).map((project) => localizeProject(project, locale))

  return (
    <>
      <Head>
        <title>{t.archiveTitle} — Gulchiroy Matroziyeva</title>
        <meta name="description" content={t.archiveIntro} />
      </Head>
      <main className="archive-shell">
        <nav className="archive-nav">
          <Link href="/careers/owner/portfolio"><ArrowLeft size={17} /> {t.backHome}</Link>
          <LanguageSwitcher />
          <span>{t.archiveLabel}</span>
        </nav>
        <header className="archive-hero">
          <p className="eyebrow">{t.collection}</p>
          <h1>{t.archiveHero}</h1>
          <p>{t.archiveIntro}</p>
        </header>
        <section className="archive-list" aria-label={t.allProjects}>
          {projects.map((project) => (
            <Link className="archive-row" href={`/careers/owner/archive/${project.id}`} key={project.id}>
              <span className="year">{project.start_at.slice(0, 4)}</span>
              <div><h2>{project.title}</h2><p>{project.made_at || t.independent}</p></div>
              <div className="tag-list">{project.stacks.map((stack) => <span key={stack}>{stack}</span>)}</div>
              <ArrowUpRight />
            </Link>
          ))}
        </section>
      </main>
    </>
  )
}

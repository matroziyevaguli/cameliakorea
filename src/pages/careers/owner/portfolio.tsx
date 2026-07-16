import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Mail, MapPin } from 'lucide-react'
import { EXPERIENCE_LIST, PROJECTS_LIST } from '@/consts'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { localizeExperience, localizeProject, useI18n } from '@/lib/i18n'

const featuredProjectIds = [15, 14, 0, 8]

export default function Home() {
  const { locale, t } = useI18n()
  const featuredProjects = featuredProjectIds
    .map((id) => PROJECTS_LIST.find((project) => project.id === id))
    .filter(Boolean)
    .map((project) => project ? localizeProject(project, locale) : project)

  return (
    <>
      <Head>
        <title>{t.metaTitle}</title>
        <meta name="description" content={t.metaDescription} />
        <meta property="og:title" content={t.metaTitle} />
        <meta property="og:description" content={t.metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og.png" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <div className="site-shell">
        <header className="topbar">
          <a className="brand" href="#top" aria-label="Gulchiroy Matroziyeva, back to top">
            <span className="brand-mark">GM</span>
            <span className="brand-name">Gulchiroy Matroziyeva</span>
          </a>
          <nav className="desktop-nav" aria-label="Primary navigation">
            <a href="#work">{t.nav[0]}</a>
            <a href="#about">{t.nav[1]}</a>
            <a href="#experience">{t.nav[2]}</a>
          </nav>
          <div className="topbar-actions"><LanguageSwitcher /><a className="contact-pill" href="mailto:gulin9717@gmail.com">{t.talk} <ArrowUpRight size={16} /></a></div>
        </header>

        <main id="top">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-glow" aria-hidden="true" />
            <div className="availability"><span /> {t.available}</div>
            <h1 id="hero-title">
              <span className="hero-title-line">{t.hero1}</span>
              <span className="hero-title-line hero-title-script">{t.hero2}</span>
            </h1>
            <div className="hero-bottom">
              <p>{t.heroBody}</p>
              <a className="round-link" href="#work" aria-label={t.explore}><ArrowDownRight size={28} /></a>
            </div>
            <div className="hero-meta">
              <span><MapPin size={15} /> {t.location}</span>
              <span>React · NestJS · Swift · Three.js</span>
              <span>{t.delivery}</span>
            </div>
          </section>

          <section className="work-section" id="work" aria-labelledby="work-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t.selected}</p>
                <h2 id="work-title">{t.workTitle}</h2>
              </div>
              <p>{t.workIntro}</p>
            </div>

            <div className="project-grid">
              {featuredProjects.map((project, index) => project && (
                <Link href={`/careers/owner/archive/${project.id}`} className={`project-card project-${index + 1}`} key={project.id}>
                  <div className="project-visual">
                    <span className="project-index">0{index + 1}</span>
                    {project.image[0] ? (
                      <Image src={project.image[0].uri} alt={project.title} fill sizes="(max-width: 800px) 100vw, 50vw" />
                    ) : (
                      <div className="project-placeholder" aria-hidden="true"><span>{project.id === 12 ? '3D / SOLAR' : 'AI / LEARNING'}</span><strong>{project.id === 12 ? 'SUN → DATA' : 'PROMPT → QUIZ'}</strong></div>
                    )}
                    <span className="project-arrow"><ArrowUpRight size={20} /></span>
                  </div>
                  <div className="project-copy">
                    <div>
                      <span className="project-kicker">{project.made_at || t.independent} · {project.start_at.slice(0, 4)}</span>
                      <h3>{project.title}</h3>
                    </div>
                    <p>{project.description}</p>
                    <ul aria-label={t.technologies}>
                      {project.stacks.map((stack) => <li key={stack}>{stack}</li>)}
                    </ul>
                  </div>
                </Link>
              ))}
            </div>

            <Link href="/careers/owner/archive" className="text-link">{t.explore} <ArrowRight size={18} /></Link>
          </section>

          <section className="about-section" id="about" aria-labelledby="about-title">
            <p className="eyebrow">{t.about}</p>
            <div className="about-grid">
              <h2 id="about-title">{t.aboutTitle}</h2>
              <div className="about-copy">
                <p className="lead">{t.lead}</p>
                <p>{t.bio}</p>
                <div className="principles">
                  {t.principles.map((principle, index) => <span key={principle}>0{index + 1} <strong>{principle}</strong></span>)}
                </div>
              </div>
            </div>
          </section>

          <section className="experience-section" id="experience" aria-labelledby="experience-title">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">{t.experience}</p>
                <h2 id="experience-title">{t.experienceTitle}</h2>
              </div>
              <a href="/resume.pdf" target="_blank" rel="noreferrer" className="text-link">{t.resume} <ArrowUpRight size={17} /></a>
            </div>
            <div className="timeline">
              {EXPERIENCE_LIST.map((role) => localizeExperience(role, locale)).map((role) => (
                <a className="timeline-row" href={role.url} target="_blank" rel="noreferrer" key={role.id}>
                  <span className="timeline-date">{role.start_at} — {role.end_at}</span>
                  <div><h3>{role.title}</h3><p>{role.subTitle}</p></div>
                  <p className="timeline-description">{role.description}</p>
                  <ArrowUpRight className="timeline-arrow" size={19} />
                </a>
              ))}
            </div>
          </section>

          <section className="contact-section" aria-labelledby="contact-title">
            <p className="eyebrow">{t.contact}</p>
            <h2 id="contact-title">{t.contactTitle}</h2>
            <a href="mailto:gulin9717@gmail.com" className="big-email">gulin9717@gmail.com <ArrowUpRight /></a>
            <div className="contact-footer">
              <p>{t.contactBody}</p>
              <div className="socials" aria-label="Social links">
                <a href="https://github.com/gulin01" target="_blank" rel="noreferrer" aria-label="GitHub">
                  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.7 7.7 0 0 1 8 3.56c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
                </a>
                <a href="https://www.linkedin.com/in/gulchiroy-matroziyeva-b42420175" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2ZM8 19H5v-9h3v9ZM6.5 8.25A1.75 1.75 0 1 1 6.5 4.75a1.75 1.75 0 0 1 0 3.5ZM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0 0 13 14.19V19h-3v-9h2.9v1.3a3.11 3.11 0 0 1 2.7-1.4c1.55 0 3.4.86 3.4 3.66V19Z" /></svg>
                </a>
                <a href="mailto:gulin9717@gmail.com" aria-label="Email"><Mail /></a>
              </div>
            </div>
          </section>
        </main>

        <footer className="site-footer"><span>© {new Date().getFullYear()} Gulchiroy Matroziyeva</span><span>{t.footer}</span></footer>
      </div>
    </>
  )
}



import { PROJECTS_LIST, ProjectsProps } from '@/consts'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

const Projects = () => {

    return (
        <section id="projects" className="mb-16 scroll-mt-16 md:mb-24 lg:mb-36 lg:scroll-mt-24" aria-label="Selected projects">
            <div className="sticky top-0 z-20 -mx-6 mb-4 w-screen bg-slate-900/75 px-6 py-5 backdrop-blur md:-mx-12 md:px-12 lg:sr-only lg:relative lg:top-auto lg:mx-auto lg:w-full lg:px-0 lg:py-0 lg:opacity-0">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-200 lg:sr-only">Projects</h2>
            </div>
            <div>
                <ul className="group/list">
                    {PROJECTS_LIST.slice(0, 4).map((val: ProjectsProps) => (
                        <li className="mb-12" key={val.id}>
                            <div className="group relative grid gap-4 pb-1 transition-all sm:grid-cols-8 sm:gap-8 md:gap-4 lg:hover:!opacity-100 lg:group-hover/list:opacity-50">
                                <div className="absolute -inset-x-4 -inset-y-4 z-0 hidden rounded-md transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:group-hover:bg-slate-800/50 lg:group-hover:shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] lg:group-hover:drop-shadow-lg">
                                </div>
                                <div className="z-10 sm:order-2 sm:col-span-6">
                                    <h3>
                                        <Link className="inline-flex items-baseline font-medium leading-tight text-slate-200 hover:text-teal-300 focus-visible:text-teal-300  group/link text-base" href={`/archive/${val.id}`} rel="noreferrer" aria-label="Spotify Profile">
                                            <span className="absolute -inset-x-4 -inset-y-2.5 hidden rounded md:-inset-x-6 md:-inset-y-4 lg:block">                                                </span>
                                            <span>{val.title}
                                                <span className="inline-block">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="inline-block h-4 w-4 shrink-0 transition-transform group-hover/link:-translate-y-1 group-hover/link:translate-x-1 group-focus-visible/link:-translate-y-1 group-focus-visible/link:translate-x-1 motion-reduce:transition-none ml-1 translate-y-px" aria-hidden="true">
                                                        <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clip-rule="evenodd">
                                                        </path>
                                                    </svg>
                                                </span>
                                            </span>
                                        </Link>
                                    </h3>
                                    <p className="mt-2 text-sm leading-normal text-slate-200">{val.description}</p>
                                    <a className="relative mt-2 inline-flex items-center text-sm font-medium text-slate-300 hover:text-teal-300 focus-visible:text-teal-300" href="https://github.com/bchiang7/spotify-profile" target="_blank" rel="noreferrer" aria-label="550 stars on GitHub">
                                    </a>
                                    <ul className="mt-2 flex flex-wrap" aria-label="Technologies used:">
                                        {val.stacks.map(val => (
                                            <li className="mr-1.5 mt-2" key={val}>
                                                <div className="flex items-center rounded-full bg-teal-400/10 px-3 py-1 text-xs font-medium leading-5 text-teal-300 ">{val}</div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <Image alt="" src={val.image[0].uri} loading="lazy" width="200" height="48" decoding="async" data-nimg="1" className="rounded border-2 border-slate-200/10 transition group-hover:border-slate-200/30 sm:order-1 sm:col-span-2 sm:translate-y-1" style={{ color: "transparent" }} />
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </section >
    )
}

export default Projects
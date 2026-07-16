
import React from 'react'
import Experiences from './Experiences';
import Projects from './Projects';
import Link from 'next/link';

export default () => {
    return (
        <div className="pt-24 lg:w-1/2 lg:py-24 z-20 ">
            <section id="about" className="mb-16 scroll-mt-16 md:mb-24 lg:mb-36 lg:scroll-mt-24" aria-label="About me">
                <div className="sticky top-0 z-20 -mx-6 mb-4 w-screen bg-slate-900/75 px-6 py-5 backdrop-blur md:-mx-12 md:px-12 lg:sr-only lg:relative lg:top-auto lg:mx-auto lg:w-full lg:px-0 lg:py-0 lg:opacity-0">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-200 lg:sr-only">About</h2>
                </div>
                <div>
                    <p className="mb-4 line-clamp-[15] hover:line-clamp-none text-slate-200">
                        I am Matroziyeva Gulchiroy, born in Namangan, Uzbekistan in 1997. My journey into software development began unexpectedly during my second year at university. Initially majoring in computer science, I was clueless about my path until I started learning mathematics from scratch. Understanding mathematics transformed my comprehension of programming concepts, from declaring variables to creating loops and algorithms. This newfound clarity revealed the profound potential of software development as a tool to serve humanity.
                        Driven by this realization, I delved deeper into the software development field, mastering the basics of several programming languages, including C, C++, C#, Python, and JavaScript. As I explored these languages, I understood their unique applications for developing different types of software. My journey continued with learning React, which felt intuitive and cohesive, especially with a background in HTML, CSS, and JavaScript.

                        I have a passion for learning new technologies and taking on challenges. For instance, while working at 4cgate, I volunteered to work on a mobile application project written in Swift with iOS Storyboard, despite having no prior experience. My curiosity and determination helped me navigate and succeed in this new environment, reinforcing my belief that fundamental programming concepts transcend specific languages.

                        My development experience spans both web and iOS platforms. I enjoy creating applications that enhance user experiences and save time. The thought of someone using my project and finding it useful motivates and excites me. My dedication to software development is driven by a desire to contribute to making people's lives easier with efficient and user-friendly solutions.

                        I am confident in my skills and always bring a positive attitude to the table. I believe I was born to contribute to society by simplifying everyday tasks through technology, often with just one click.
                    </p>
                </div>
            </section>
            <Experiences />
            <Projects />
            <div className="mt-10" />
            <Link className="inline-flex items-center leading-tight font-semibold text-slate-200 group" aria-label="View Full Project Archive" href="/archive">
                <span>
                    <span className="border-b border-transparent pb-px transition group-hover:border-teal-300 motion-reduce:transition-none">View Full Project </span><span className="whitespace-nowrap">
                        <span className="border-b border-transparent pb-px transition group-hover:border-teal-300 motion-reduce:transition-none">Archive</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="ml-1 inline-block h-4 w-4 shrink-0 -translate-y-px transition-transform group-hover:translate-x-2 group-focus-visible:translate-x-2 motion-reduce:transition-none" aria-hidden="true">
                            <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd"></path>
                        </svg>
                    </span>
                </span>
            </Link>
            <section id="writing" className="mb-16 scroll-mt-16 md:mb-24 lg:mb-36 lg:scroll-mt-24" aria-label="Blog posts">
                <div className="sticky top-0 z-20 -mx-6 mb-4 w-screen bg-slate-900/75 px-6 py-5 backdrop-blur md:-mx-12 md:px-12 lg:sr-only lg:relative lg:top-auto lg:mx-auto lg:w-full lg:px-0 lg:py-0 lg:opacity-0">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-200 lg:sr-only">Writing</h2>
                </div>
            </section>
            <footer className="max-w-md pb-16 text-sm text-slate-500 sm:pb-0">
                <h2 className="text-sm my-1 font-bold uppercase tracking-widest text-slate-200">Contacts</h2>
                <a href='mailto:gulin9717@gmail.com'>Email: gulin9717@gmail.com </a>
            </footer>
        </div >
    )
};


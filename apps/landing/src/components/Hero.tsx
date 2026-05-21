import type React from 'react';

/** Full-width hero section with headline, tagline, and primary CTAs. */
export default function Hero(): React.ReactElement {
    return (
        <section className="bg-nb-yellow border-b-4 border-nb-black py-24 px-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="font-black text-nb-black uppercase text-6xl md:text-8xl leading-none tracking-tight mb-6">
                    ALL YOUR TASKS.
                    <br />
                    ONE PLACE.
                </h1>
                <p className="font-bold text-nb-black text-xl md:text-2xl mb-10 max-w-xl">
                    Connect Todoist, Google Tasks, and more. Manage everything from a single dashboard, CLI, or AI
                    agent.
                </p>
                <div className="flex gap-4 flex-wrap">
                    <a
                        href="#"
                        className="bg-nb-black text-white font-black uppercase tracking-wide border-2 border-nb-black px-6 py-3 shadow-[4px_4px_0px_#111111] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                    >
                        GET STARTED →
                    </a>
                    <a
                        href="#"
                        className="bg-white text-nb-black font-black uppercase tracking-wide border-2 border-nb-black px-6 py-3 shadow-[4px_4px_0px_#111111] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                    >
                        VIEW DOCS →
                    </a>
                </div>
            </div>
        </section>
    );
}

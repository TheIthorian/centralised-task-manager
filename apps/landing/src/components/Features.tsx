import type React from 'react';

type Feature = {
    /** Stroke path for a 24x24 outline glyph. Decorative: the heading carries the meaning. */
    glyph: string;
    title: string;
    description: string;
};

const features: Feature[] = [
    {
        glyph: 'M4 7h16M4 12h10M4 17h6',
        title: 'Aggregate',
        description: 'Pull tasks from Todoist, Google Tasks, and more into a single, unified view.',
    },
    {
        glyph: 'M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-5.5-2 2m-7 7-2 2m0-11 2 2m7 7 2 2',
        title: 'Fuzzy Deadlines',
        description: "Mark tasks as 'this week', 'this month', or 'someday' — without touching the source.",
    },
    {
        glyph: 'M8 9l-3 3 3 3m8-6 3 3-3 3m-2-9-4 12',
        title: 'CLI + AI Agent',
        description: 'Manage your tasks from the terminal or through Claude and other AI agents via MCP.',
    },
    {
        glyph: 'M6 9a6 6 0 1 1 12 0c0 4 2 5 2 5H4s2-1 2-5m4 9a2 2 0 0 0 4 0',
        title: 'Smart Reminders',
        description: 'Daily and weekly nudges for tasks that actually need your attention.',
    },
];

/** Grid of feature cards explaining what CTM does. */
export default function Features(): React.ReactElement {
    return (
        <section id="what-it-does" className="border-b border-line px-6 py-24">
            <div className="mx-auto max-w-6xl">
                <h2 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">What it does</h2>
                <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {features.map((feature) => (
                        <div key={feature.title} className="rounded-ctm border border-line bg-panel p-6">
                            <svg
                                viewBox="0 0 24 24"
                                width="24"
                                height="24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-accent"
                                aria-hidden="true"
                                focusable="false"
                            >
                                <path d={feature.glyph} />
                            </svg>
                            <h3 className="mt-4 text-base font-semibold text-fg">{feature.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-muted">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

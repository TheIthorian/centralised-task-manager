import type React from 'react';

type Step = {
    number: string;
    title: string;
    description: string;
};

const steps: Step[] = [
    {
        number: '01',
        title: 'Connect your task apps',
        description: 'Link Todoist, Google Tasks, or any supported source via OAuth in seconds.',
    },
    {
        number: '02',
        title: 'Tasks sync automatically',
        description: 'CTM polls your sources every 15 minutes and keeps everything up to date.',
    },
    {
        number: '03',
        title: 'Manage from anywhere',
        description: 'Use the web dashboard, the CLI, or your AI agent — all backed by the same API.',
    },
];

/** Numbered step-by-step breakdown of how CTM works. */
export default function HowItWorks(): React.ReactElement {
    return (
        <section id="how-it-works" className="border-b border-line bg-panel px-6 py-24">
            <div className="mx-auto max-w-4xl">
                <h2 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">How it works</h2>
                <ol className="mt-12 flex flex-col gap-8">
                    {steps.map((step) => (
                        <li key={step.number} className="flex items-start gap-5">
                            {/* Decorative: the list already conveys order, and a numeral read aloud twice is noise. */}
                            <span
                                className="flex size-11 shrink-0 items-center justify-center rounded-ctm bg-nav-on-bg text-sm font-semibold text-accent"
                                aria-hidden="true"
                            >
                                {step.number}
                            </span>
                            <div>
                                <h3 className="text-lg font-semibold text-fg">{step.title}</h3>
                                <p className="mt-1 leading-relaxed text-muted">{step.description}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}

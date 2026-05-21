import type React from 'react';

interface Step {
    number: string;
    title: string;
    description: string;
}

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
        <section className="bg-nb-yellow border-b-4 border-nb-black py-24 px-6">
            <div className="max-w-4xl mx-auto">
                <h2 className="font-black text-nb-black uppercase text-4xl md:text-5xl mb-12">HOW IT WORKS</h2>
                <div className="flex flex-col gap-6">
                    {steps.map((step) => (
                        <div key={step.number} className="flex gap-6 items-start">
                            <div className="min-w-16 h-16 bg-nb-black text-nb-yellow font-black text-xl flex items-center justify-center border-2 border-nb-black shrink-0">
                                {step.number}
                            </div>
                            <div className="pt-2">
                                <h3 className="font-black text-nb-black uppercase text-xl mb-1">{step.title}</h3>
                                <p className="font-bold text-nb-black leading-relaxed">{step.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

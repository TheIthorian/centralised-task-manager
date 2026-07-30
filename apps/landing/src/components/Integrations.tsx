import type React from 'react';
import { BrandIcon, type BrandKey } from '@ctm/ui';

type Integration = {
    brand: BrandKey;
    name: string;
};

const integrations: Integration[] = [
    { brand: 'todoist', name: 'Todoist' },
    { brand: 'google_tasks', name: 'Google Tasks' },
];

/** Cards showing supported task app integrations. */
export default function Integrations(): React.ReactElement {
    return (
        <section id="works-with" className="border-b border-line px-6 py-24">
            <div className="mx-auto max-w-6xl">
                <h2 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">Works with</h2>
                <p className="mt-4 text-muted">Connect your existing task apps. More integrations coming soon.</p>
                <ul className="mt-12 flex flex-wrap gap-3">
                    {integrations.map((integration) => (
                        <li
                            key={integration.brand}
                            className="flex items-center gap-3 rounded-ctm border border-line bg-panel px-5 py-4"
                        >
                            <BrandIcon brand={integration.brand} size={24} />
                            <span className="font-medium text-fg">{integration.name}</span>
                        </li>
                    ))}
                    <li className="flex items-center gap-3 rounded-ctm border border-dashed border-line px-5 py-4">
                        <svg
                            viewBox="0 0 24 24"
                            width="24"
                            height="24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            className="text-muted"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path d="M12 6v12M6 12h12" />
                        </svg>
                        <span className="text-muted">More coming soon</span>
                    </li>
                </ul>
            </div>
        </section>
    );
}

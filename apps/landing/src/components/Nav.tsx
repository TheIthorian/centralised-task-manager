import type React from 'react';
import { LinkButton } from '@ctm/ui';

type Section = {
    href: string;
    label: string;
};

const sections: Section[] = [
    { href: '#what-it-does', label: 'What it does' },
    { href: '#how-it-works', label: 'How it works' },
    { href: '#works-with', label: 'Works with' },
];

/** Sticky navigation bar with the CTM logotype, section links and a get-started CTA. */
export default function Nav(): React.ReactElement {
    return (
        <nav className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
                <a
                    href="#top"
                    className="inline-flex min-h-11 items-center rounded-ctm text-base font-semibold tracking-tight text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-0"
                >
                    CTM
                </a>
                <div className="flex items-center gap-1 md:gap-2">
                    <ul className="hidden items-center gap-1 md:flex">
                        {sections.map((section) => (
                            <li key={section.href}>
                                <a
                                    href={section.href}
                                    className="inline-flex min-h-11 items-center rounded-ctm px-3 text-sm text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:transition-colors motion-safe:duration-press md:min-h-0 md:py-1.5"
                                >
                                    {section.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                    <LinkButton href="#">Get started</LinkButton>
                </div>
            </div>
        </nav>
    );
}

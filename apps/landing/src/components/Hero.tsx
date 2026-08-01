import type React from 'react';
import { Badge, LinkButton } from '@ctm/ui';

/** Full-width hero section with headline, tagline, and primary CTAs. */
export default function Hero(): React.ReactElement {
    return (
        <section id="top" className="border-b border-line px-6 py-24 md:py-32">
            <div className="mx-auto max-w-4xl">
                <Badge variant="neutral">Todoist · Google Tasks · MCP</Badge>
                <h1 className="mt-6 text-5xl leading-[1.05] font-semibold tracking-tight text-fg md:text-7xl">
                    All your tasks.
                    <br />
                    <span className="text-accent">One place.</span>
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted md:text-xl">
                    Connect Todoist, Google Tasks, and more. Manage everything from a single dashboard, CLI, or AI
                    agent.
                </p>
                <div className="mt-10 flex flex-wrap gap-3">
                    <LinkButton href="#" size="lg">
                        Get started
                    </LinkButton>
                    <LinkButton href="#" size="lg" variant="secondary">
                        View docs
                    </LinkButton>
                </div>
            </div>
        </section>
    );
}

import type React from 'react';
import { LinkButton } from '@ctm/ui';

/** Footer with a final call-to-action and copyright. */
export default function FooterCta(): React.ReactElement {
    const year = new Date().getFullYear();

    return (
        <footer className="bg-panel px-6 py-24">
            <div className="mx-auto max-w-4xl text-center">
                <h2 className="text-3xl leading-tight font-semibold tracking-tight text-fg md:text-5xl">
                    Ready to take control?
                </h2>
                <p className="mt-6 text-lg text-muted">One place for all your tasks. Connect in seconds.</p>
                <div className="mt-10 flex justify-center">
                    <LinkButton href="#" size="lg">
                        Get started
                    </LinkButton>
                </div>
                <p className="mt-16 text-sm text-muted">© {year} CTM</p>
            </div>
        </footer>
    );
}

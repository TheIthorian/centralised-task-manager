import type React from 'react';

/** Sticky navigation bar with the CTM logotype and a get-started CTA. */
export default function Nav(): React.ReactElement {
    return (
        <nav className="sticky top-0 z-50 bg-nb-black border-b-4 border-nb-black">
            <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
                <span className="text-nb-yellow font-black text-2xl uppercase tracking-widest">CTM</span>
                <a
                    href="#"
                    className="border-2 border-white text-white font-black uppercase tracking-wide px-4 py-2 text-sm hover:bg-white hover:text-nb-black transition-colors"
                >
                    GET STARTED →
                </a>
            </div>
        </nav>
    );
}

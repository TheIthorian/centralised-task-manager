import type React from 'react';

export default function FooterCta(): React.ReactElement {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-nb-black py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="font-black text-nb-yellow uppercase text-4xl md:text-6xl leading-tight mb-6">
          READY TO TAKE CONTROL?
        </h2>
        <p className="font-bold text-white text-lg mb-10">
          One place for all your tasks. Connect in seconds.
        </p>
        <a
          href="#"
          className="inline-block bg-nb-yellow text-nb-black font-black uppercase tracking-wide border-2 border-nb-yellow px-8 py-4 text-lg shadow-[4px_4px_0px_#FFDE59] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
        >
          GET STARTED →
        </a>
        <p className="text-white/40 font-bold mt-16 text-sm uppercase tracking-widest">
          © {year} CTM
        </p>
      </div>
    </footer>
  );
}

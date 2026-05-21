import type React from 'react';

interface Integration {
  name: string;
  color: string;
  initial: string;
}

const integrations: Integration[] = [
  { name: 'Todoist', color: '#DB4035', initial: 'T' },
  { name: 'Google Tasks', color: '#4285F4', initial: 'G' },
];

export default function Integrations(): React.ReactElement {
  return (
    <section className="bg-white border-b-4 border-nb-black py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-black text-nb-black uppercase text-4xl md:text-5xl mb-4">
          WORKS WITH
        </h2>
        <p className="font-bold text-nb-black text-lg mb-12">
          Connect your existing task apps. More integrations coming soon.
        </p>
        <div className="flex flex-wrap gap-6">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="flex items-center gap-4 bg-white border-2 border-nb-black shadow-[4px_4px_0px_#111111] px-6 py-4"
            >
              <div
                className="w-10 h-10 flex items-center justify-center font-black text-white text-lg border-2 border-nb-black shrink-0"
                style={{ backgroundColor: integration.color }}
              >
                {integration.initial}
              </div>
              <span className="font-black text-nb-black uppercase text-lg">
                {integration.name}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-4 border-2 border-dashed border-nb-black px-6 py-4">
            <div className="w-10 h-10 flex items-center justify-center font-black text-nb-black text-xl border-2 border-dashed border-nb-black shrink-0">
              +
            </div>
            <span className="font-bold text-nb-black uppercase text-sm tracking-wide">
              MORE COMING SOON
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

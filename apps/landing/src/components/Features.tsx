import type React from 'react';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: '⚡',
    title: 'Aggregate',
    description:
      'Pull tasks from Todoist, Google Tasks, and more into a single, unified view.',
  },
  {
    icon: '🎯',
    title: 'Fuzzy Deadlines',
    description:
      "Mark tasks as 'this week', 'this month', or 'someday' — without touching the source.",
  },
  {
    icon: '🤖',
    title: 'CLI + AI Agent',
    description:
      'Manage your tasks from the terminal or through Claude and other AI agents via MCP.',
  },
  {
    icon: '🔔',
    title: 'Smart Reminders',
    description:
      'Daily and weekly nudges for tasks that actually need your attention.',
  },
];

export default function Features(): React.ReactElement {
  return (
    <section className="bg-white border-b-4 border-nb-black py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-black text-nb-black uppercase text-4xl md:text-5xl mb-12">
          WHAT IT DOES
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white border-2 border-nb-black shadow-[4px_4px_0px_#111111] p-6"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="font-black text-nb-black uppercase text-lg mb-2">
                {feature.title}
              </h3>
              <p className="font-bold text-nb-black text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

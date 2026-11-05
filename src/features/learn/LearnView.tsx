import { useState } from 'react';
import { useT, type GlossaryId } from '../../content/i18n';
import { Icon } from '../../components/Icon';
import { useStore } from '../../state/store';

export default function LearnView() {
  const t = useT();
  const L = t.learnContent;
  const [q, setQ] = useState('');
  const openCase = useStore((s) => s.openCase);
  const terms = (Object.keys(t.glossary) as GlossaryId[]).filter((id) => {
    const e = t.glossary[id];
    return !q || `${e.term} ${e.def}`.toLowerCase().includes(q.toLowerCase());
  });
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-3 pb-12 sm:px-5">
      <header>
        <div className="eyebrow">{t.nav.learn}</div>
        <h1 className="text-3xl font-semibold">{t.learn.title}</h1>
        <p className="mt-1 text-ink-2">{t.learn.intro}</p>
      </header>

      <section aria-labelledby="how">
        <h2 id="how" className="mb-3 text-xl font-semibold">
          {t.learn.howTitle}
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {L.how.map((s) => (
            <li key={s.title} className="panel p-4">
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-[14px] text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => openCase('snow', 0)} className="mt-3 inline-flex items-center gap-2 text-accent hover:underline">
          <Icon name="folder" size={16} /> {t.learn.tryCase}
        </button>
      </section>

      <section aria-labelledby="glossary">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="glossary" className="text-xl font-semibold">
            {t.learn.glossary}
          </h2>
          <label className="relative">
            <span className="sr-only">{t.learn.searchGlossary}</span>
            <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.learn.searchGlossary} className="rounded-lg border border-line bg-surface-2 py-1.5 pl-8 pr-3 text-[14px]" />
          </label>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {terms.map((id) => (
            <div key={id} className="panel p-4" id={`term-${id}`}>
              <dt className="font-semibold">{t.glossary[id].term}</dt>
              <dd className="mt-1 text-[14px] text-ink-2">{t.glossary[id].def}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="methods">
        <h2 id="methods" className="mb-1 text-xl font-semibold">
          {t.learn.methodsTitle}
        </h2>
        <p className="mb-3 text-[14px] text-ink-2">{L.verification}</p>
        <div className="space-y-3">
          {L.methods.map((m) => (
            <details key={m.title} className="panel p-4">
              <summary className="cursor-pointer font-semibold">{m.title}</summary>
              <p className="mono mt-2 overflow-x-auto rounded-md bg-surface-2 px-3 py-2 text-[13px] text-ink-1">{m.formula}</p>
              <p className="mt-2 text-[14px] text-ink-2">{m.body}</p>
            </details>
          ))}
        </div>
        <h3 className="mb-2 mt-6 font-semibold">{t.learn.assumptionsTitle}</h3>
        <ul className="list-disc space-y-1 pl-5 text-[14px] text-ink-2">
          {L.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="giovanni">
        <h2 id="giovanni" className="mb-2 text-xl font-semibold">
          {t.learn.giovanniTitle}
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-[14px] text-ink-2">
          {L.giovanni.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="refs">
        <h2 id="refs" className="mb-2 text-xl font-semibold">
          {t.learn.referencesTitle}
        </h2>
        <ul className="space-y-1.5 text-[13px] text-ink-2">
          {L.references.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

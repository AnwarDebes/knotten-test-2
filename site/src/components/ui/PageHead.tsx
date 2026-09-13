import type { ReactNode } from "react";

/** The opening of every inner page: a title with room to breathe, one lede, optional action. */
export default function PageHead({ title, lede, action, children }: { title: string; lede?: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className="wrap pt-12 md:pt-20 pb-8 md:pb-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] items-end">
        <div>
          <h1 className="display text-[clamp(42px,6vw,88px)] max-w-[14ch]">{title}</h1>
          {lede && <p className="lede mt-6 max-w-[54ch]">{lede}</p>}
          {children}
        </div>
        {action && <div className="flex flex-wrap gap-3">{action}</div>}
      </div>
    </section>
  );
}

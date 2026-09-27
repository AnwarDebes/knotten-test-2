import Link from "next/link";

export default function PageHead({ title, crumb, children, aside }: { title: string; crumb: string; children?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="phead">
      <div className="wrap">
        <div className="crumb"><Link href="/">Forside</Link> / {crumb}</div>
        <div className="row">
          <div>
            <h1>{title}</h1>
            {children}
          </div>
          {aside}
        </div>
      </div>
    </section>
  );
}

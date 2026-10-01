"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/ui/Logo";
import Icon, { type IconName } from "./Icon";
import { logout } from "@/app/(moderne)/[locale]/login/actions";
import { endPreview, startPreview } from "@/app/(moderne)/[locale]/portal/actions";
import { PREVIEWS } from "@/lib/auth-shared";
import { PreviewContext } from "./PreviewContext";

export type NavItem = { href: string; label: string; icon: IconName; exact?: boolean; sub?: { href: string; label: string; exact?: boolean }[]; badge?: number };
export type NavGroup = { title?: string; items: NavItem[] };
export type Me = { name: string; email: string; role: string; initials: string };

const isOn = (path: string, href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));

/**
 * The portal's application frame: a sidebar with only the areas this person can open, a slim top
 * bar, and on phones the sidebar as a drawer. The links are decided on the server (PortalLayout);
 * this part only knows which one is open.
 */
export default function PortalFrame({ locale, groups, me, children, preview, canPreview, plots = [] }: { locale: "no" | "en"; groups: NavGroup[]; me: Me; children: React.ReactNode; preview?: string; canPreview?: boolean; plots?: string[] }) {
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const no = locale === "no";
  const other = locale === "no" ? "en" : "no";
  const current = groups.flatMap((g) => g.items.flatMap((i) => [...(i.sub ?? []).filter((s) => isOn(path, s.href, s.exact)).map((s) => s.label), ...(isOn(path, i.href, i.exact) ? [i.label] : [])]))[0];
  const close = () => setOpen(false);
  return (
    <div className="pt">
      {open && <div className="pt-scrim" onClick={close} aria-hidden />}
      <aside className={`pt-side${open ? " open" : ""}`} aria-label={no ? "Portalmeny" : "Portal menu"}>
        <div className="flex items-center justify-between gap-2">
          <Link href={`/${locale}/portal`} className="pt-brand" onClick={close} aria-label={no ? "Portalens forside" : "Portal home"}>
            <Logo height={30} />
          </Link>
          <button type="button" className="pt-icon-btn lg:hidden" onClick={close} aria-label={no ? "Lukk menyen" : "Close menu"}><Icon name="close" /></button>
        </div>
        <div className="pt-tag">{no ? "Prosjektportal" : "Project portal"}</div>
        <nav className="grid">
          {groups.map((g, gi) => (
            <div key={gi} className="pt-group">
              {g.title && <p>{g.title}</p>}
              {g.items.map((it) => {
                const on = isOn(path, it.href, it.exact) || !!it.sub?.some((s) => isOn(path, s.href, s.exact));
                return (
                  <div key={it.href}>
                    <Link href={it.href} onClick={close} className={`pt-link${on ? " on" : ""}`} aria-current={isOn(path, it.href, true) ? "page" : undefined}>
                      <Icon name={it.icon} />
                      <span className="flex-1">{it.label}</span>
                      {!!it.badge && <span className="pt-badge">{it.badge}</span>}
                    </Link>
                    {it.sub && on && (
                      <div className="pt-sub">
                        {it.sub.map((s) => (
                          <Link key={s.href} href={s.href} onClick={close} className={`pt-link${isOn(path, s.href, s.exact) ? " on" : ""}`} aria-current={isOn(path, s.href, true) ? "page" : undefined}>{s.label}</Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="pt-me">
          <Link href={`/${locale}/portal/konto`} onClick={close} className={`pt-link !py-2${isOn(path, `/${locale}/portal/konto`) ? " on" : ""}`}>
            <span className="avatar">{me.initials}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">{me.name}</span>
              <span className="block truncate text-[12.5px] text-muted">{me.role}</span>
            </span>
          </Link>
          <form action={logout}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="to" value={`/${locale}/login`} />
            <button className="pt-link w-full"><Icon name="logout" /><span>{no ? "Logg ut" : "Log out"}</span></button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex flex-col">
        {preview && (
          <div className="pt-preview-bar" role="status">
            <span><strong>{no ? "Forhåndsvisning" : "Preview"}:</strong> {no ? `du ser portalen slik ${PREVIEWS.find((p) => p.id === preview)?.as.no ?? preview} ser den. Endringer er slått av.` : `you see the portal as ${PREVIEWS.find((p) => p.id === preview)?.as.en ?? preview} sees it. Changes are switched off.`}</span>
            <form action={endPreview}><input type="hidden" name="lang" value={locale} /><button className="pt-preview-end">{no ? "Avslutt forhåndsvisningen" : "End the preview"}</button></form>
          </div>
        )}
        <header className="pt-top">
          <button type="button" className="pt-icon-btn lg:hidden" onClick={() => setOpen(true)} aria-label={no ? "Åpne menyen" : "Open menu"} aria-expanded={open}><Icon name="menu" /></button>
          <div className="min-w-0 flex-1 truncate text-[14.5px]">
            <span className="text-muted hidden sm:inline">{no ? "Prosjektportal" : "Project portal"}</span>
            {current && <><span className="text-muted hidden sm:inline mx-2">/</span><span className="font-medium">{current}</span></>}
          </div>
          {canPreview && !preview && (
            <details className="pt-menu">
              <summary className="pt-top-link list-none cursor-pointer"><Icon name="user" size={16} /><span className="hidden sm:inline">{no ? "Se som" : "View as"}</span></summary>
              <div className="pt-menu-panel">
                <div className="text-[12.5px] text-muted px-3 pt-1 pb-2">{no ? "Se portalen slik andre ser den. Bare det de har tilgang til vises, og ingenting kan endres." : "See the portal as others see it. Only what they can open is shown, and nothing can be changed."}</div>
                {PREVIEWS.map((p) => (
                  <form key={p.id} action={startPreview} className="pt-menu-item">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="lang" value={locale} />
                    {p.id === "resident" ? (
                      <div className="flex items-center gap-2">
                        <button className="flex-1 text-left">{p.label[locale]}</button>
                        <select name="plot" defaultValue="plot-07" className="input !py-1 !px-2 !w-auto !text-[13px]" aria-label={no ? "Tomt" : "Plot"}>{plots.map((x) => <option key={x} value={x}>{no ? "tomt" : "plot"} {Number(x.slice(5))}</option>)}</select>
                      </div>
                    ) : (
                      <button className="w-full text-left">{p.label[locale]}</button>
                    )}
                  </form>
                ))}
              </div>
            </details>
          )}
          <Link href={path.replace(/^\/(no|en)(?=\/|$)/, `/${other}`)} className="pt-top-link" hrefLang={other} lang={other}>{other === "en" ? "English" : "Norsk"}</Link>
          <Link href="/" className="pt-top-link"><Icon name="external" size={16} /><span className="hidden sm:inline">{no ? "Til nettsiden" : "To the website"}</span></Link>
        </header>
        <div className="pt-body"><PreviewContext.Provider value={preview}>{children}</PreviewContext.Provider></div>
      </div>
    </div>
  );
}

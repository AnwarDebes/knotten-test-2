import { AREAS, AREA_LABEL, ROLE_LABEL, type AccountRole } from "@/lib/auth-shared";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { loadAuth, type Account } from "@/lib/server/accounts";
import { MAIL_ON } from "@/lib/server/mail";
import { loadPlots } from "@/lib/data";
import { dismissResetRequest, inviteUser, setUserStatus, updateUser, userLink } from "../actions";
import NoAccess from "@/components/portal/NoAccess";
import { ActionForm, ConfirmButton } from "@/components/portal/forms";
import { Notice, PageHead, Section, initials, when } from "@/components/portal/ui";
import { logText } from "@/lib/logText";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Brukere og tilgang", "Users and access");

const STATUS = { invited: { no: "Invitert", en: "Invited" }, active: { no: "Aktiv", en: "Active" }, disabled: { no: "Deaktivert", en: "Disabled" } };

/**
 * Who can use the portal, with which role and which areas. Administrators invite and manage users;
 * super administrators also manage administrators and see the security log. Invitations and
 * password links are emailed when email is set up, and otherwise shown once to copy.
 */
export default async function Users({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/admin/brukere", "admin");
  if (!ok) return <NoAccess locale={locale} session={session} area="admin" />;
  const [auth, { plots }] = await Promise.all([loadAuth(), loadPlots()]);
  const superadmin = session.role === "superadmin";
  const roles: AccountRole[] = superadmin ? ["user", "admin", "superadmin"] : ["user"];
  const order = { superadmin: 0, admin: 1, user: 2 } as const;
  const accounts = [...auth.accounts].sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  const mayManage = (a: Account) => a.id !== session.id && (superadmin || a.role === "user");
  const L = { no, locale };
  return (
    <>
      <PageHead
        eyebrow={no ? "Administrasjon" : "Administration"}
        title={no ? "Brukere og tilgang" : "Users and access"}
        lede={no ? "Tre roller: bruker, administrator og superadministrator. En bruker ser bare de områdene kontoen har fått tilgang til, for eksempel datarommet for en investor eller kommunerommet for kommunen." : "Three roles: user, administrator and super administrator. A user sees only the areas they have been given, for example the data room for an investor or the municipality room for the municipality."}
      />
      {!MAIL_ON && <Notice>{no ? "E-post er ikke satt opp, så invitasjoner og passordlenker vises her for å kopieres og sendes. Med e-post (Resend) sendes de automatisk." : "Email is not set up, so invitations and password links are shown here to copy and send. With email (Resend) they are sent automatically."}</Notice>}

      {auth.reset_requests.length > 0 && (
        <Section title={no ? "Ber om nytt passord" : "Asking for a new password"} sub={no ? "Disse har bedt om nytt passord på innloggingssiden. Lag en lenke og send den, eller avvis." : "These asked for a new password on the login page. Make a link and send it, or dismiss."}>
          <div className="panel divide-y divide-[var(--line)]">
            {auth.reset_requests.map((r) => {
              const a = auth.accounts.find((x) => x.email === r.email);
              return (
                <div key={r.email + r.at} className="p-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                  <div className="text-[14.5px]"><span className="font-medium">{a?.name ?? r.email}</span> <span className="text-muted">{r.email} · {when(r.at, locale)}</span></div>
                  <div className="flex flex-wrap items-start gap-3">
                    {a && mayManage(a) && (
                      <ActionForm action={userLink} submit={no ? "Lag lenke" : "Make link"} buttonClass="btn btn-sm btn-ghost btn-plain" className="grid gap-2">
                        <input type="hidden" name="id" value={a.id} /><input type="hidden" name="lang" value={locale} />
                      </ActionForm>
                    )}
                    <form action={dismissResetRequest}><input type="hidden" name="email" value={r.email} /><button className="text-[13px] text-muted hover:underline mt-2">{no ? "Avvis" : "Dismiss"}</button></form>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px] items-start">
        <Section title={no ? `Kontoer (${accounts.length})` : `Accounts (${accounts.length})`}>
          <div className="panel divide-y divide-[var(--line)]">
            {accounts.map((a) => (
              <div key={a.id} className="p-4 md:p-5 grid gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="avatar">{initials(a.name, a.email)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{a.name}{a.id === session.id && <span className="text-muted font-normal"> ({no ? "deg" : "you"})</span>}</div>
                    <div className="text-[13px] text-muted truncate">{a.email}{a.org ? ` · ${a.org}` : ""}</div>
                  </div>
                  <span className={`chip ${a.role === "superadmin" ? "chip-fjord" : a.role === "admin" ? "chip-fjord" : ""}`}>{ROLE_LABEL[a.role][locale]}</span>
                  <span className={`chip ${a.status === "active" ? "chip-pine" : a.status === "invited" ? "chip-amber" : ""}`}>{STATUS[a.status][locale]}</span>
                </div>
                <div className="text-[13px] text-muted">
                  {a.role === "user" ? (a.areas.length ? a.areas.map((x) => AREA_LABEL[x][locale]).join(", ") : (no ? "Ingen områder" : "No areas")) : (no ? "Alle områder" : "All areas")}
                  {a.plot && ` · ${no ? "tomt" : "plot"} ${Number(a.plot.slice(5))}`}
                  {" · "}{a.last_login ? `${no ? "sist inne" : "last in"} ${when(a.last_login, locale)}` : (no ? "aldri logget inn" : "never logged in")}
                </div>
                {mayManage(a) && (
                  <div className="flex flex-wrap items-start gap-x-5 gap-y-2 text-[13.5px]">
                    <details className="w-full sm:w-auto">
                      <summary className="cursor-pointer text-fjord list-none">{no ? "Endre rolle og tilgang" : "Change role and access"}</summary>
                      <div className="mt-3 max-w-[520px]"><AccountFields a={a} roles={roles} plots={plots.map((p) => p.id)} {...L} /></div>
                    </details>
                    {a.status !== "disabled" && (
                      <details>
                        <summary className="cursor-pointer text-fjord list-none">{a.status === "invited" ? (no ? "Ny invitasjonslenke" : "New invitation link") : (no ? "Lenke for nytt passord" : "New password link")}</summary>
                        <div className="mt-3 max-w-[520px]">
                          <ActionForm action={userLink} submit={no ? "Lag lenke" : "Make link"} buttonClass="btn btn-sm btn-ghost btn-plain">
                            <input type="hidden" name="id" value={a.id} /><input type="hidden" name="lang" value={locale} />
                            <p className="text-[13px] text-muted">{a.status === "invited" ? (no ? "Den gamle invitasjonen slutter å virke." : "The old invitation stops working.") : (no ? "Lenken gjelder i ett døgn. Passordet endres først når personen velger et nytt." : "The link lasts one day. The password only changes when the person chooses a new one.")}</p>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                    <form action={setUserStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value={a.status === "disabled" ? "enable" : "disable"} /><button className="text-ink-2 hover:underline">{a.status === "disabled" ? (no ? "Aktiver igjen" : "Enable again") : (no ? "Deaktiver" : "Disable")}</button></form>
                    <ConfirmButton action={setUserStatus} fields={{ id: a.id, op: "delete" }} label={no ? "Slett konto" : "Delete account"} question={no ? `Slette kontoen til ${a.name}? Dette kan ikke angres.` : `Delete ${a.name}'s account? This cannot be undone.`} className="text-[13.5px] text-amber-ink hover:underline" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
        <Section title={no ? "Inviter noen" : "Invite someone"}>
          <div className="panel p-5 md:p-6"><AccountFields roles={roles} plots={plots.map((p) => p.id)} {...L} /></div>
          <div className="panel-2 p-5 grid gap-2 text-[13.5px]">
            {(["user", "admin", "superadmin"] as const).map((r) => (
              <div key={r}><span className="font-medium">{ROLE_LABEL[r][locale]}: </span><span className="text-ink-2">{{ user: no ? "ser områdene den har fått, og kan spørre og laste ned der." : "sees the areas it has been given, and can ask and download there.", admin: no ? "ser alt, svarer på henvendelser, styrer interessenter, tomter, nyheter og brukere." : "sees everything, answers questions, runs leads, plots, news and users.", superadmin: no ? "som administrator, og styrer også administratorer og sikkerheten." : "as administrator, and also manages administrators and security." }[r]}</span></div>
            ))}
          </div>
        </Section>
      </div>

      {superadmin && (
        <Section title={no ? "Sikkerhetslogg" : "Security log"} sub={no ? "Innlogginger, mislykkede forsøk, invitasjoner og endringer i tilgang. De siste 60." : "Logins, failed attempts, invitations and changes of access. The last 60."}>
          <div className="panel scroll-x">
            <table className="table table-tight min-w-[560px]">
              <thead><tr><th>{no ? "Når" : "When"}</th><th>{no ? "Hvem" : "Who"}</th><th>{no ? "Hva" : "What"}</th></tr></thead>
              <tbody>{auth.audit.slice(0, 60).map((x, i) => <tr key={i}><td className="whitespace-nowrap">{when(x.at, locale)}</td><td>{logText(x.who, locale)}</td><td className={x.what.includes("mislykket") ? "text-amber-ink" : ""}>{logText(x.what, locale)}</td></tr>)}</tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
}

function AccountFields({ a, roles, plots, no, locale }: { a?: Account; roles: AccountRole[]; plots: string[]; no: boolean; locale: "no" | "en" }) {
  return (
    <ActionForm action={a ? updateUser : inviteUser} submit={a ? (no ? "Lagre" : "Save") : (no ? "Inviter" : "Invite")} pending={a ? undefined : (no ? "Inviterer …" : "Inviting …")} className="grid gap-3">
      <input type="hidden" name="lang" value={locale} />
      {a && <input type="hidden" name="id" value={a.id} />}
      <label className="grid gap-1.5 text-[13.5px]"><span className="font-medium text-ink-2">{no ? "Navn" : "Name"}</span><input name="name" required defaultValue={a?.name} className="input !py-2" autoComplete="off" /></label>
      {!a && <label className="grid gap-1.5 text-[13.5px]"><span className="font-medium text-ink-2">E-post</span><input name="email" type="email" required className="input !py-2" autoComplete="off" /></label>}
      <label className="grid gap-1.5 text-[13.5px]"><span className="font-medium text-ink-2">{no ? "Firma, kommune eller institusjon" : "Company, municipality or institution"}</span><input name="org" defaultValue={a?.org} className="input !py-2" /></label>
      <label className="grid gap-1.5 text-[13.5px]">
        <span className="font-medium text-ink-2">{no ? "Rolle" : "Role"}</span>
        <select name="role" defaultValue={a?.role ?? "user"} className="input !py-2">{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r][locale]}</option>)}</select>
      </label>
      <fieldset className="grid gap-1.5 text-[13.5px]">
        <legend className="font-medium text-ink-2 mb-1">{no ? "Områder (for brukere)" : "Areas (for users)"}</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {AREAS.map((x) => (
            <label key={x} className="flex items-start gap-2 text-[14px]"><input type="checkbox" name="areas" value={x} defaultChecked={a ? a.areas.includes(x) : false} className="mt-1" /><span>{AREA_LABEL[x][locale]}<span className="block text-[12px] text-muted">{AREA_LABEL[x].hint[locale]}</span></span></label>
          ))}
        </div>
        <span className="text-[12px] text-muted">{no ? "Administratorer har alle områder." : "Administrators have every area."}</span>
      </fieldset>
      <label className="grid gap-1.5 text-[13.5px]">
        <span className="font-medium text-ink-2">{no ? "Tomt (for beboere)" : "Plot (for residents)"}</span>
        <select name="plot" defaultValue={a?.plot ?? ""} className="input !py-2"><option value="">{no ? "Ingen" : "None"}</option>{plots.map((p) => <option key={p} value={p}>{no ? "Tomt" : "Plot"} {Number(p.slice(5))}</option>)}</select>
      </label>
    </ActionForm>
  );
}

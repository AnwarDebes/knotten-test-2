import type { Locale } from "@/lib/i18n";
import { getRole } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/auth-shared";
import { readStore } from "@/lib/store";
import Gate from "@/components/portal/Gate";
import { removeUser, saveUser } from "../actions";

export const dynamic = "force-dynamic";

/** Who can log in, and as what. Super administrators only. */
export default async function Users({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const role = await getRole();
  if (role !== "superadmin") return <Gate locale={locale} role={role} need={["admin"]} />;
  const store = await readStore();
  const roles = ["user", "admin", "superadmin"] as const;
  const help = { user: no ? "Ser portalen: datarom, energi, tvilling." : "Sees the portal: data room, energy, twin.", admin: no ? "Alt over, pluss interessenter, tomter, priser, nyheter og innstillinger." : "All of the above, plus leads, plots, prices, news and settings.", superadmin: no ? "Alt over, pluss brukere og roller." : "All of the above, plus users and roles." };
  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <h1 className="display text-[clamp(34px,4.5vw,56px)]">{no ? "Brukere og roller" : "Users and roles"}</h1>
        <p className="text-[15px] text-muted mt-2 max-w-[52ch]">{no ? "Tre roller, som avtalt: bruker, administrator og superadministrator. I forhåndsvisningen sjekkes ikke passord; i produksjon logger disse inn med e-post." : "Three roles, as agreed: user, administrator and super administrator. The preview checks no passwords; in production these people log in by email."}</p>
        <table className="table mt-6">
          <thead><tr><th>{no ? "Navn" : "Name"}</th><th>E-post</th><th>{no ? "Rolle" : "Role"}</th><th>{no ? "Lagt til" : "Added"}</th><th></th></tr></thead>
          <tbody>
            {store.users.map((u) => (
              <tr key={u.email}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <form action={saveUser} className="flex items-center gap-2">
                    <input type="hidden" name="email" value={u.email} />
                    <select name="role" defaultValue={u.role} className="input !py-1.5 !w-auto !text-[14px]">{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r][locale]}</option>)}</select>
                    <button className="btn btn-sm btn-plain">{no ? "Lagre" : "Save"}</button>
                  </form>
                </td>
                <td className="whitespace-nowrap">{u.added}</td>
                <td><form action={removeUser}><input type="hidden" name="email" value={u.email} /><button className="text-[13px] text-amber">{no ? "Fjern" : "Remove"}</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 grid gap-2 text-[14px] max-w-[60ch]">
          {roles.map((r) => <div key={r} className="grid grid-cols-[150px_1fr] gap-3"><span className="font-medium">{ROLE_LABEL[r][locale]}</span><span className="text-muted">{help[r]}</span></div>)}
        </div>
      </div>
      <form action={saveUser} className="panel p-5 md:p-6 grid gap-3 content-start">
        <div className="display text-[24px]">{no ? "Gi noen tilgang" : "Give someone access"}</div>
        <label className="grid gap-1 text-[13px]">{no ? "Navn" : "Name"}<input className="input !py-2" name="name" /></label>
        <label className="grid gap-1 text-[13px]">E-post<input className="input !py-2" name="email" type="email" required /></label>
        <label className="grid gap-1 text-[13px]">{no ? "Rolle" : "Role"}<select name="role" className="input !py-2" defaultValue="user">{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r][locale]}</option>)}</select></label>
        <button className="btn btn-amber btn-sm justify-self-start">{no ? "Legg til" : "Add"}</button>
      </form>
    </div>
  );
}

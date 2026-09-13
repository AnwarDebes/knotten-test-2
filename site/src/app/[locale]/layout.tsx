import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import Footer from "@/components/ui/Footer";
import Chat from "@/components/ui/Chat";
import Motion from "@/components/ui/Motion";

export function generateStaticParams() {
  return [{ locale: "no" }, { locale: "en" }];
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <>
      <main className="flex-1">{children}</main>
      <Footer locale={locale} />
      <Chat locale={locale} />
      <Motion />
    </>
  );
}

import Link from "next/link";
import { US_LOGIN_PATH, US_SIGNUP_HREF, US_SUPPORT_EMAIL, US_TERMS_PATH } from "@/lib/us/config";

// English header/footer for the US public pages (/us, /terms, /kayit/us). The Turkish
// NavBar/Footer from the root layout hide themselves on these paths.
export default function UsShell({ children }: { children: React.ReactNode }) {
  return (
    <div lang="en" className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/us" className="text-lg font-bold tracking-tight text-navy-900 dark:text-foreground">
            Locally<span className="ml-1.5 text-sm font-medium text-muted-foreground">for restaurants</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/us#pricing" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              Pricing
            </Link>
            <Link href={US_LOGIN_PATH} className="text-muted-foreground hover:text-foreground">
              Log in
            </Link>
            <Link
              href={US_SIGNUP_HREF}
              className="rounded-md bg-teal-600 px-3.5 py-1.5 font-semibold text-white hover:bg-teal-700"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <p>© {new Date().getFullYear()} Locally</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href={US_TERMS_PATH} className="hover:text-foreground">
              Terms &amp; Merchant Agreement
            </Link>
            {US_SUPPORT_EMAIL && (
              <a href={`mailto:${US_SUPPORT_EMAIL}`} className="hover:text-foreground">
                {US_SUPPORT_EMAIL}
              </a>
            )}
            <Link href="/?market=tr" className="hover:text-foreground" hrefLang="tr">
              Türkiye
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/nav-bar";
import Footer from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { getSelectedCity } from "@/lib/locations-server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMissingEnvVars } from "@/lib/env";
import ConfigError from "@/components/config-error";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  variable: "--font-serif",
  display: "swap",
  style: ["normal", "italic"],
});

const SITE_DESCRIPTION =
  "Bodrum'da sezon dışında işletmeleri ve yerel halkı buluşturan yerel keşif pazaryeri.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Locally — Yerel fırsatları keşfet",
    template: "%s — Locally",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Locally",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Locally",
  },
  openGraph: {
    title: "Locally — Yerel fırsatları keşfet",
    description: SITE_DESCRIPTION,
    siteName: "Locally",
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Locally — Yerel fırsatları keşfet",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a121c" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const missingEnvVars = getMissingEnvVars().filter((key) =>
    key.startsWith("NEXT_PUBLIC_SUPABASE")
  );

  if (missingEnvVars.length > 0) {
    return (
      <html lang="tr" suppressHydrationWarning>
        <body
          className={`${inter.variable} ${newsreader.variable} font-sans antialiased bg-background text-foreground`}
        >
          <ConfigError missingEnvVars={missingEnvVars} />
        </body>
      </html>
    );
  }

  const city = getSelectedCity();
  const user = await getCurrentUser();

  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${newsreader.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <div className="flex min-h-dvh flex-col">
            <NavBar city={city} user={user} />
            <main className="flex-1 pb-16 md:pb-0">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

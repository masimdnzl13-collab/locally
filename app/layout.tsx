import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/nav-bar";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Locally — Kasabanın kışı da güzel",
  description:
    "Bodrum'da sezon dışında işletmeleri ve yerel halkı buluşturan platform.",
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b3d4c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${jakarta.variable} font-sans antialiased bg-white text-dark-900`}>
        <div className="flex min-h-dvh flex-col">
          <NavBar />
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
        </div>
      </body>
    </html>
  );
}

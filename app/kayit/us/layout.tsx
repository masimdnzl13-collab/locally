import UsShell from "@/components/us/us-shell";

// ABD kayıt akışı (/kayit/us, /odeme, /durum): Türkçe NavBar/Footer bu yolda
// gizlenir (bkz. isUsPublicPath), yerine İngilizce başlık/altlık çizilir.
export default function UsSignupLayout({ children }: { children: React.ReactNode }) {
  return <UsShell>{children}</UsShell>;
}

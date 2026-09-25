import { redirect } from "next/navigation";

// Eski "Abonelik" yer tutucusu; gerçek sayfa Faturalandırma.
export default function AbonelikPage() {
  redirect("/panel/faturalandirma");
}

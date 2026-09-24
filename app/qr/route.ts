import { NextResponse, type NextRequest } from "next/server";
import { US_QR_TARGET } from "@/lib/us/config";

// Sahada bırakılan basılı QR kodlarının gömdüğü kısa bağlantı. Basılı kodlar
// değiştirilemediği için hedef burada tutulur; 307 (geçici) — tarayıcılar
// kalıcı olarak önbelleğe almasın, hedef ileride değişebilsin.
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL(US_QR_TARGET, request.url), 307);
}

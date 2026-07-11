import { NextResponse } from "next/server";
import { finalizeCheckout } from "@/lib/purchases/checkout";

export const dynamic = "force-dynamic";

async function handleCallback(request: Request, tokenFromQuery: string | null) {
  let token = tokenFromQuery;

  if (!token && request.method === "POST") {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("form")) {
      const form = await request.formData();
      token = String(form.get("token") ?? "") || null;
    } else {
      try {
        const body = await request.json();
        token = body?.token ?? null;
      } catch {
        token = null;
      }
    }
  }

  const origin = new URL(request.url).origin;

  if (!token) {
    return NextResponse.redirect(`${origin}/satin-alma/basarisiz`, { status: 303 });
  }

  const result = await finalizeCheckout(token);

  if (!result || result.status === "failed") {
    return NextResponse.redirect(
      `${origin}/satin-alma/basarisiz?purchase=${result?.purchaseId ?? ""}`,
      { status: 303 }
    );
  }

  return NextResponse.redirect(`${origin}/satin-alma/basarili?purchase=${result.purchaseId}`, {
    status: 303,
  });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  return handleCallback(request, searchParams.get("token"));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return handleCallback(request, searchParams.get("token"));
}

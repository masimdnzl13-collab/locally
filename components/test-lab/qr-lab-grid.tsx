import { cn } from "@/lib/utils";
import type { TestLabQrItem } from "@/lib/test-lab/queries";

const CODE_TYPE_LABEL: Record<TestLabQrItem["codeType"], string> = {
  package: "Paket hakkı (LCL)",
  flash: "Flaş ayırtması (FLA)",
  ticket: "Etkinlik bileti (TKT)",
  invalid: "Uydurma kod",
};

const SCENARIO_STYLE: Record<TestLabQrItem["scenario"], string> = {
  valid: "border-success-200 bg-success-50",
  wrong_business: "border-danger-200 bg-danger-50",
  no_uses_left: "border-danger-200 bg-danger-50",
  expired: "border-danger-200 bg-danger-50",
  invalid_code: "border-danger-200 bg-danger-50",
};

const SCENARIO_LABEL: Record<TestLabQrItem["scenario"], string> = {
  valid: "✅ Geçerli",
  wrong_business: "❌ Başka işletmeye ait",
  no_uses_left: "❌ Hakları tükenmiş",
  expired: "❌ Süresi dolmuş",
  invalid_code: "❌ Tamamen geçersiz",
};

export default function QrLabGrid({ items }: { items: TestLabQrItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.key}
          className={cn("rounded-lg border p-4 text-center", SCENARIO_STYLE[item.scenario])}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {CODE_TYPE_LABEL[item.codeType]}
          </p>
          {item.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.qrDataUrl}
              alt={`QR: ${item.code}`}
              className="mx-auto mt-2 h-36 w-36 rounded-md border border-border bg-white p-1"
            />
          ) : null}
          <p className="mt-2 select-all break-all font-mono text-sm font-semibold text-foreground">
            {item.code}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.belongsTo}</p>
          <p className="mt-2 text-xs font-bold">{SCENARIO_LABEL[item.scenario]}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.expectedResult}</p>
          {item.expectedErrorCode ? (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              error_code: {item.expectedErrorCode}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

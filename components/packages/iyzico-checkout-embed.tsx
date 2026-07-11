"use client";

import { useEffect, useRef } from "react";

// iyzico'nun checkoutFormContent alanı bir <script> içerir; innerHTML ile
// eklenen script etiketleri tarayıcı tarafından çalıştırılmaz, bu yüzden
// script düğümlerini elle yeniden oluşturup DOM'a ekliyoruz.
export default function IyzicoCheckoutEmbed({ formContent }: { formContent: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = formContent;

    const scripts = Array.from(container.querySelectorAll("script"));
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) =>
        newScript.setAttribute(attr.name, attr.value)
      );
      newScript.text = oldScript.text;
      oldScript.replaceWith(newScript);
    });
  }, [formContent]);

  return <div id="iyzipay-checkout-form" className="responsive" ref={containerRef} />;
}

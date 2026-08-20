"use client";

import { Button } from "@/components/ui/button";

export default function PrintButton() {
  return (
    <Button type="button" variant="teal" size="sm" onClick={() => window.print()}>
      Yazdır / PDF olarak kaydet
    </Button>
  );
}

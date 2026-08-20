"use client";

import { useState, useTransition } from "react";
import { signInAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TEST_LAB_PASSWORD } from "@/lib/test-lab/constants";

export default function AccountCard({
  label,
  email,
  description,
}: {
  label: string;
  email: string;
  description: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", TEST_LAB_PASSWORD);
    startTransition(async () => {
      const result = await signInAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{label}</p>
        <p className="mt-2 break-all font-mono text-sm text-foreground">{email}</p>
        <p className="break-all font-mono text-sm text-muted-foreground">{TEST_LAB_PASSWORD}</p>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
        <Button
          type="button"
          variant="teal"
          size="sm"
          className="mt-3 w-full"
          disabled={isPending}
          onClick={handleSubmit}
        >
          {isPending ? "..." : "Bu hesapla giriş yap"}
        </Button>
        {error && <p className="mt-2 text-xs font-medium text-danger-700">{error}</p>}
      </CardContent>
    </Card>
  );
}

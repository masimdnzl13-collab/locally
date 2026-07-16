"use client";

import { useState, type ReactNode } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";

export default function MyStuffSwitcher({
  packagesView,
  ticketsView,
}: {
  packagesView: ReactNode;
  ticketsView: ReactNode;
}) {
  const [section, setSection] = useState<"paketler" | "biletler">("paketler");

  return (
    <div>
      <div className="mx-auto max-w-2xl px-6 pt-6">
        <SegmentedControl
          layoutId="my-stuff-switcher"
          className="w-fit"
          options={[
            { value: "paketler", label: "Paketler" },
            { value: "biletler", label: "Biletler" },
          ]}
          value={section}
          onChange={setSection}
        />
      </div>

      {section === "paketler" ? packagesView : ticketsView}
    </div>
  );
}

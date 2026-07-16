import AnnouncementWizard from "@/components/panel/announcement-wizard";

export default function NewAnnouncementPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        Yeni Duyuru
      </h1>
      <AnnouncementWizard />
    </div>
  );
}

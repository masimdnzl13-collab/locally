import { getModerationContent } from "@/lib/admin/queries";
import ContentModerationView from "@/components/admin/content-moderation-view";

export default async function AdminContentPage() {
  const items = await getModerationContent();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 text-xl font-bold tracking-tight text-ink-900">
        İçerik Gözetimi
      </h1>
      <ContentModerationView items={items} />
    </div>
  );
}

import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { adminListMedia } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const res = await adminListMedia(60);
  const [assets, configured] = res.ok ? [res.data.media, true] : [[], false];

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Media</p>
        <h1 className="mt-1.5 text-[26px] font-bold tracking-[-0.03em]">Image library</h1>
      </header>
      <MediaLibrary assets={assets} configured={configured} />
    </div>
  );
}

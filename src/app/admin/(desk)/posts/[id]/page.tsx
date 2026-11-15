import { notFound } from "next/navigation";
import { PostEditor } from "@/components/admin/PostEditor";
import { adminGetPost, adminListMedia } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";

  const [postRes, mediaRes] = await Promise.all([isNew ? Promise.resolve(null) : adminGetPost(id), adminListMedia(24)]);
  if (!isNew && postRes && !postRes.ok) notFound();

  return (
    <PostEditor
      post={postRes && postRes.ok ? postRes.data.post : undefined}
      media={mediaRes.ok ? mediaRes.data.media : []}
    />
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import type { MediaAsset } from "@/lib/server/platform";

type SignResponse = { cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string; uploadUrl: string };

const kb = (n: number | null) => (n ? (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`) : "—");

/**
 * Uploads go browser → Cloudinary directly, using a signature minted by the API.
 * The image bytes never pass through Render, which keeps that service small and
 * cheap, and the API secret never reaches the browser.
 */
export function MediaLibrary({ assets, configured }: { assets: MediaAsset[]; configured: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [alt, setAlt] = useState("");

  const upload = async (files: FileList) => {
    setBusy(true);
    setError(null);
    for (const file of Array.from(files)) {
      setProgress(`Uploading ${file.name}…`);
      try {
        const signRes = await fetch("/api/platform/admin/media/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder: "journal" }),
        });
        const sign = (await signRes.json().catch(() => null)) as SignResponse | { error?: { message?: string } } | null;
        if (!signRes.ok || !sign || "error" in sign) {
          setError((sign as { error?: { message?: string } })?.error?.message ?? "Could not get an upload signature.");
          break;
        }
        const s = sign as SignResponse;

        const form = new FormData();
        form.append("file", file);
        form.append("api_key", s.apiKey);
        form.append("timestamp", String(s.timestamp));
        form.append("folder", s.folder);
        form.append("signature", s.signature);

        const uploaded = await fetch(s.uploadUrl, { method: "POST", body: form });
        const result = await uploaded.json().catch(() => null);
        if (!uploaded.ok || !result?.secure_url) {
          setError(result?.error?.message ?? "Cloudinary rejected the upload.");
          break;
        }

        const record = await fetch("/api/platform/admin/media/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicId: result.public_id,
            url: result.secure_url,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            folder: s.folder,
            alt: alt || file.name,
          }),
        });
        if (!record.ok) {
          const j = await record.json().catch(() => null);
          setError(j?.error?.message ?? "Uploaded, but could not be recorded in the library.");
          break;
        }
      } catch {
        setError("Upload failed — check your connection.");
        break;
      }
    }
    setProgress(null);
    setBusy(false);
    setAlt("");
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this asset from the library?")) return;
    await fetch(`/api/platform/admin/media/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-line-2 bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-semibold">Upload</h2>
            <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-ink-3">
              Images are stored on Cloudinary and served from its CDN. Uploads are signed server-side, so nothing here
              exposes an API secret, and large files never touch the API server.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Alt text (accessibility)"
              className="input !h-11 md:!h-9 w-48 !text-[12.5px]"
            />
            <button
              type="button"
              disabled={busy || !configured}
              onClick={() => inputRef.current?.click()}
              className="h-11 rounded-sm border md:h-9 border-ink bg-signal px-4 text-[13px] font-semibold hover:bg-ink hover:text-signal disabled:opacity-50"
            >
              {busy ? "Working…" : "Choose images"}
            </button>
          </div>
        </div>
        {!configured && (
          <p className="mt-4 rounded-sm border border-[#d6b24a] bg-warn-bg px-3 py-2 text-[12.5px] leading-relaxed text-warn">
            Cloudinary is not configured on the API. Set <code className="font-mono">CLOUDINARY_CLOUD_NAME</code>,{" "}
            <code className="font-mono">CLOUDINARY_API_KEY</code> and <code className="font-mono">CLOUDINARY_API_SECRET</code> on the
            Render service, then redeploy. Uploads stay disabled until then — the buttons are not decorative.
          </p>
        )}
        {progress && <p className="mt-3 font-mono text-[12px] text-ink-2">{progress}</p>}
        {error && <p role="alert" className="mt-3 rounded-sm border border-[#e0a49f] bg-stop-bg px-3 py-2 text-[12.5px] text-[#7d1a14]">{error}</p>}
      </section>

      {assets.length === 0 ? (
        <div className="rounded-md border border-dashed border-line-2 bg-card/60 px-6 py-16 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">Empty library</p>
          <h2 className="mt-3 text-[19px] font-semibold">No images yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-ink-3">Upload a cover image for the next article.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-md border border-line-2 bg-card">
              <div className="aspect-[4/3] bg-paper-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt} loading="lazy" className="h-full w-full object-cover" />
              </div>
              <div className="p-2.5">
                <p className="truncate font-mono text-[11px] text-ink-2" title={m.publicId}>{m.publicId.split("/").pop()}</p>
                <p className="mt-0.5 font-mono text-[10.5px] text-ink-3">
                  {m.width && m.height ? `${m.width}×${m.height} · ` : ""}{kb(m.bytes)}
                </p>
                <div className="mt-2 flex gap-1.5">
                  <button type="button" onClick={() => copy(m.url)} className={cn("h-7 flex-1 rounded-xs border text-[11.5px] font-semibold", copied === m.url ? "border-go bg-go-bg text-go" : "border-line-2 hover:border-ink")}>
                    {copied === m.url ? "Copied" : "Copy URL"}
                  </button>
                  <button type="button" onClick={() => remove(m.id)} className="h-7 rounded-xs border border-line-2 px-2 text-[11.5px] text-ink-3 hover:border-stop hover:text-stop" aria-label={`Remove ${m.publicId}`}>
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

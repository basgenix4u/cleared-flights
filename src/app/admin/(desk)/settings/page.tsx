import { SettingsEditor } from "@/components/admin/SettingsEditor";
import { adminListSettings } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const res = await adminListSettings();
  const rows = res.ok ? res.data.settings.map((s) => ({ key: s.key, value: s.value, updatedAt: s.updatedAt })) : [];

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Settings</p>
        <h1 className="mt-1.5 text-[26px] font-bold tracking-[-0.03em]">Runtime switches</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">
          Change how the site behaves without deploying. Everything here is audited: the person, the time and the previous value.
        </p>
      </header>
      {!res.ok && (
        <p className="rounded-sm border border-[#e0a49f] bg-stop-bg px-3 py-2 text-[13px] text-[#7d1a14]">
          {res.message}
        </p>
      )}
      <SettingsEditor rows={rows} />
    </div>
  );
}

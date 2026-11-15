"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Row {
  key: string;
  value: unknown;
  updatedAt: string;
}

/** Known keys get a hint; unknown keys are allowed but flagged, because typos are silent. */
const KNOWN: Record<string, string> = {
  "site.announcement": '{"text": "…", "tone": "info"} — banner shown site-wide',
  "search.paused": "true | false — block new searches without a deploy",
  "support.hours": '"24/7" or any string shown on the help page',
  "featured.routes": '["LOS-LHR", "JFK-LHR"] — routes shown first on the home page',
};

export function SettingsEditor({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Row[]>(rows);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("{}");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (key: string, raw: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setMsg({ kind: "err", text: `${key}: that is not valid JSON.` });
      return;
    }
    setBusy(key);
    const res = await fetch(`/api/platform/admin/settings/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: parsed }),
    });
    const json = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) {
      setMsg({ kind: "err", text: json?.error?.message ?? "Could not save." });
      return;
    }
    setMsg({ kind: "ok", text: `${key} saved.` });
    router.refresh();
  };

  const remove = async (key: string) => {
    if (!window.confirm(`Delete the setting "${key}"?`)) return;
    setBusy(key);
    await fetch(`/api/platform/admin/settings/${encodeURIComponent(key)}`, { method: "DELETE" });
    setItems((r) => r.filter((x) => x.key !== key));
    setBusy(null);
    router.refresh();
  };

  const add = async () => {
    if (!/^[a-z0-9_.-]{2,60}$/.test(newKey)) {
      setMsg({ kind: "err", text: "Keys use lowercase letters, digits, dot, dash or underscore." });
      return;
    }
    await save(newKey, newValue);
    setItems((r) => [{ key: newKey, value: JSON.parse(newValue), updatedAt: new Date().toISOString() }, ...r.filter((x) => x.key !== newKey)]);
    setNewKey("");
    setNewValue("{}");
  };

  return (
    <div className="space-y-6">
      {msg && (
        <p role="status" className={`rounded-sm border px-3 py-2 text-[13px] ${msg.kind === "ok" ? "border-[#9cc9b0] bg-go-bg text-go" : "border-[#e0a49f] bg-stop-bg text-[#7d1a14]"}`}>
          {msg.text}
        </p>
      )}

      <section className="rounded-md border border-line-2 bg-card p-5">
        <h2 className="text-[16px] font-semibold">Add a setting</h2>
        <p className="mt-1 text-[13px] text-ink-3">Values are JSON. Booleans, strings and arrays are all valid.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[220px_1fr_auto]">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="search.paused" className="input !h-11 md:!h-9 !text-[12.5px]" />
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder='{"enabled": true}' className="input !h-11 md:!h-9 !font-mono !text-[12px]" />
          <button type="button" onClick={add} className="h-11 rounded-sm border md:h-9 border-ink bg-signal px-4 text-[13px] font-semibold hover:bg-ink hover:text-signal">Save</button>
        </div>
        {KNOWN[newKey] && <p className="mt-2 font-mono text-[11px] text-ink-3">{KNOWN[newKey]}</p>}
      </section>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-line-2 bg-card/60 px-6 py-14 text-center">
          <h2 className="text-[18px] font-semibold">No settings yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-ink-3">Runtime switches appear here once created.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <SettingRow key={row.key} row={row} busy={busy === row.key} onSave={save} onDelete={remove} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SettingRow({ row, busy, onSave, onDelete }: { row: Row; busy: boolean; onSave: (k: string, v: string) => void; onDelete: (k: string) => void }) {
  const [value, setValue] = useState(JSON.stringify(row.value, null, 2));
  return (
    <li className="rounded-md border border-line-2 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="font-mono text-[13px] font-semibold">{row.key}</code>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] text-ink-3">{new Date(row.updatedAt).toLocaleDateString("en-GB")}</span>
          <button type="button" disabled={busy} onClick={() => onSave(row.key, value)} className="h-7 rounded-xs border border-ink px-2.5 text-[11.5px] font-semibold hover:bg-ink hover:text-paper disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" disabled={busy} onClick={() => onDelete(row.key)} className="h-7 rounded-xs border border-line-2 px-2 text-[11.5px] text-ink-3 hover:border-stop hover:text-stop">Delete</button>
        </div>
      </div>
      {KNOWN[row.key] && <p className="mt-1 font-mono text-[10.5px] text-ink-3">{KNOWN[row.key]}</p>}
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={Math.min(8, value.split("\n").length + 1)} className="input mt-2 !h-auto w-full py-2 font-mono !text-[12px]" spellCheck={false} />
    </li>
  );
}

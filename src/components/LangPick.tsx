"use client";
import { useState } from "react";
import { REGIONS, OPEN_LANGS, enabledLanguages, findLang, cleanLang, dirFor } from "@/lib/languages";

// Pick any African language from the list, or choose "Other" and type any language name.
export function LangPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const LANGS = enabledLanguages();
  const known = !!findLang(value);
  const [other, setOther] = useState(!known && !!value);
  return (
    <>
      <select value={other ? "__other" : value} onChange={(e) => { if (e.target.value === "__other") { setOther(true); onChange(""); } else { setOther(false); onChange(e.target.value); } }}>
        {REGIONS.map((r) => (
          <optgroup key={r} label={r} hidden={!LANGS.some((l) => l.region === r)}>
            {LANGS.filter((l) => l.region === r).map((l) => <option key={l.name} value={l.name}>{l.name}{l.native !== l.name ? ` · ${l.native}` : ""}</option>)}
          </optgroup>
        ))}
        {OPEN_LANGS && <option value="__other">Another language (type its name)…</option>}
      </select>
      {other && <input className="lang-other" dir={dirFor(value, value)} placeholder="Language name, e.g. Tumbuka" maxLength={40} value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!value && !cleanLang(value)} />}
    </>
  );
}

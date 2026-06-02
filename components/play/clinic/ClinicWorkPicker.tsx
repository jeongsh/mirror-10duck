"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { searchOshiAnalysisWorks, type OshiAnalysisWork } from "@/lib/supabase/oshiAnalysis";

const MAX = 3;

export default function ClinicWorkPicker({
  label,
  hint,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OshiAnalysisWork[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      void searchOshiAnalysisWorks(query, 8).then(setResults);
    }, 280);
    return () => window.clearTimeout(t);
  }, [query]);

  const add = (title: string) => {
    if (values.includes(title) || values.length >= MAX) return;
    onChange([...values, title]);
    setQuery("");
    setOpen(false);
  };

  const remove = (title: string) => onChange(values.filter((v) => v !== title));

  return (
    <div className="block">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black text-gray-700">{label}</span>
        <span className="text-[10px] font-bold text-gray-400">{values.length}/{MAX}</span>
      </div>
      {hint && <p className="mt-0.5 text-[10px] leading-4 text-gray-500">{hint}</p>}

      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((title) => (
            <span
              key={title}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-700"
            >
              {title}
              <button type="button" onClick={() => remove(title)} aria-label={`${title} 제거`}>
                <X className="h-3 w-3 text-gray-400" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative mt-2">
        <input
          type="text"
          value={query}
          disabled={values.length >= MAX}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "작품명 검색"}
          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gray-900 disabled:bg-gray-50"
        />
        {open && results.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {results.map((work) => (
              <li key={work.id}>
                <button
                  type="button"
                  onClick={() => add(work.title)}
                  className="block w-full px-3 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  {work.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-1.5 text-[10px] font-bold text-gray-400 underline hover:text-gray-600"
      >
        작품을 몰라도 넘어가기
      </button>
    </div>
  );
}

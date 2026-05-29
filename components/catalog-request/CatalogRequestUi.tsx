"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, type ReactNode } from "react";

type CatalogRequestShellProps = {
  title: string;
  description: string;
  returnTo?: string | null;
  returnLabel?: string;
  children: ReactNode;
};

export function CatalogRequestShell({
  title,
  description,
  returnTo,
  returnLabel = "돌아가기",
  children,
}: CatalogRequestShellProps) {
  return (
    <main className="flex w-full flex-col gap-5">
      <section className="border border-dashed border-gray-500 bg-white p-5">
        {returnTo ? (
          <Link href={returnTo} className="text-xs font-bold text-gray-500 hover:underline">
            ← {returnLabel}
          </Link>
        ) : (
          <Link href="/play/catalog-request" className="text-xs font-bold text-gray-500 hover:underline">
            ← 카탈로그 요청 허브
          </Link>
        )}
        <h1 className="mt-3 text-xl font-black text-gray-900">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
      </section>
      {children}
    </main>
  );
}

export function CatalogRequestField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-black text-gray-800">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {hint && <span className="text-[11px] leading-5 text-gray-500">{hint}</span>}
      {children}
    </label>
  );
}

export function CatalogRequestInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`border border-dashed border-gray-400 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-gray-700 ${props.className ?? ""}`}
    />
  );
}

export function CatalogRequestTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[88px] resize-y border border-dashed border-gray-400 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-gray-700 ${props.className ?? ""}`}
    />
  );
}

export function CatalogRequestSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`border border-dashed border-gray-400 bg-white px-3 py-2 text-sm outline-none focus:border-gray-700 ${props.className ?? ""}`}
    />
  );
}

export function CatalogRequestSuccess({
  title,
  message,
  returnTo,
  returnLabel = "돌아가기",
}: {
  title: string;
  message: string;
  returnTo?: string | null;
  returnLabel?: string;
}) {
  return (
    <section className="border border-dashed border-green-400 bg-green-50 p-5">
      <h2 className="text-base font-black text-green-800">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-green-700">{message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {returnTo && (
          <Link
            href={returnTo}
            className="inline-flex border border-dashed border-green-600 bg-white px-3 py-2 text-xs font-bold text-green-800 hover:bg-green-100"
          >
            {returnLabel}
          </Link>
        )}
        <Link
          href="/play/catalog-request"
          className="inline-flex border border-dashed border-gray-400 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
        >
          다른 요청하기
        </Link>
      </div>
    </section>
  );
}

export function CatalogRequestError({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
      {message}
    </div>
  );
}

export function CatalogRequestSubmitButton({
  busy,
  disabled,
  children,
}: {
  busy?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || busy}
      className="w-full border border-dashed border-gray-700 bg-gray-900 px-4 py-3 text-sm font-black text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {busy ? "보내는 중..." : children}
    </button>
  );
}

export function WorkSearchPicker({
  query,
  onQueryChange,
  results,
  selected,
  onSelect,
  onClear,
  placeholder = "작품명 검색",
}: {
  query: string;
  onQueryChange: (value: string) => void;
  results: { id: string; title: string; original_title?: string | null; cover_image_url?: string | null }[];
  selected: { id: string; title: string } | null;
  onSelect: (work: { id: string; title: string }) => void;
  onClear: () => void;
  placeholder?: string;
}) {
  if (selected) {
    return (
      <div className="flex items-center gap-2 border border-dashed border-gray-500 bg-gray-50 px-3 py-2">
        <span className="flex-1 text-sm font-bold text-gray-900">{selected.title}</span>
        <button type="button" onClick={onClear} className="text-xs font-bold text-gray-500 hover:text-gray-800">
          변경
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <CatalogRequestInput
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={placeholder}
      />
      {results.length > 0 && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto border border-gray-300 bg-white shadow-lg">
          {results.map((work) => (
            <button
              key={work.id}
              type="button"
              onClick={() => onSelect({ id: work.id, title: work.title })}
              className="flex w-full items-center gap-2 border-b border-dashed border-gray-100 px-3 py-2 text-left hover:bg-gray-50 last:border-b-0"
            >
              {work.cover_image_url ? (
                <img src={work.cover_image_url} alt="" className="h-8 w-6 shrink-0 object-cover" />
              ) : (
                <div className="h-8 w-6 shrink-0 bg-gray-100" />
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-gray-900">{work.title}</p>
                {work.original_title && (
                  <p className="truncate text-[10px] text-gray-400">{work.original_title}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  changed = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  changed?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-dashed border-gray-300 bg-white">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
      >
        <div className="min-w-0">
          <p className="text-xs font-black text-gray-900">
            {title}
            {changed && (
              <span className="ml-2 border border-dashed border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                변경됨
              </span>
            )}
          </p>
          {summary && !open && (
            <p className="mt-0.5 truncate text-[10px] text-gray-500">{summary}</p>
          )}
        </div>
        {open ? (
          <ChevronUp size={14} className="shrink-0 text-gray-400" />
        ) : (
          <ChevronDown size={14} className="shrink-0 text-gray-400" />
        )}
      </button>
      {open && <div className="border-t border-dashed border-gray-200 p-3">{children}</div>}
    </div>
  );
}

export function TagCheckboxGrid({
  tags,
  selected,
  onToggle,
}: {
  tags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  if (tags.length === 0) {
    return <p className="text-xs text-gray-400">선택할 항목이 없습니다.</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const checked = selected.includes(tag);
        return (
          <label
            key={tag}
            className={`cursor-pointer border px-2 py-1 text-[11px] font-bold transition-colors ${
              checked
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-dashed border-gray-300 bg-white text-gray-500 hover:border-gray-500 hover:text-gray-700"
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={checked}
              onChange={() => onToggle(tag)}
            />
            {tag}
          </label>
        );
      })}
    </div>
  );
}

export function TagToggleGrid({
  label,
  tags,
  selected,
  onToggle,
  mode,
}: {
  label: string;
  tags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  mode: "add" | "remove";
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-black text-gray-700">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              className={`border px-2 py-1 text-[11px] font-bold transition-colors ${
                active
                  ? mode === "add"
                    ? "border-green-600 bg-green-50 text-green-800"
                    : "border-red-400 bg-red-50 text-red-700"
                  : "border-dashed border-gray-300 bg-white text-gray-600 hover:border-gray-500"
              }`}
            >
              {mode === "add" ? "+" : "−"} {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

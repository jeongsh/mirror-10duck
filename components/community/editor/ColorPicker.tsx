"use client";

import { useEffect, useRef, useState } from "react";

const PRESET_COLORS = [
  // 회색 계열
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  // 선명한 원색
  "#ff0000", "#ff6d00", "#ffff00", "#00c853", "#00bcd4", "#2962ff", "#6200ea", "#c51162", "#ff4081", "#ff6e40",
  // 중간 계열
  "#e53935", "#fb8c00", "#fdd835", "#43a047", "#00acc1", "#1e88e5", "#8e24aa", "#e91e63", "#c62828", "#e65100",
  // 연한 계열
  "#ef9a9a", "#ffcc80", "#fff59d", "#a5d6a7", "#80deea", "#90caf9", "#ce93d8", "#f48fb1", "#ffab91", "#ffe082",
  // 매우 연한/파스텔
  "#ffcdd2", "#ffe0b2", "#fff9c4", "#dcedc8", "#b2ebf2", "#e3f2fd", "#e8eaf6", "#fce4ec", "#f8bbd0", "#fff3e0",
];

interface Props {
  value: string;
  onChange: (color: string) => void;
  onBeforeCustomPick: () => void;
  icon: React.ReactNode;
  quickSetLabel: string;
  quickSetValue: string;
}

export function ColorPicker({ value, onChange, onBeforeCustomPick, icon, quickSetLabel, quickSetValue }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [open]);

  const applyPreset = (color: string, e: React.MouseEvent) => {
    e.preventDefault();
    onChange(color);
    setOpen(false);
  };

  const safeColor = value && value.startsWith("#") ? value : "#000000";

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((prev) => !prev);
        }}
        className="flex flex-col items-center gap-0.5 p-1.5 hover:bg-gray-200"
        title="색상 선택"
      >
        {icon}
        <span
          className="block h-[3px] w-3.5 border border-gray-400"
          style={{
            backgroundColor: value === "transparent" || !value ? "transparent" : value,
          }}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full z-50 border border-gray-300 bg-white p-2 shadow-lg"
          style={{ width: 172 }}
        >
          {/* 빠른 초기화 */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(quickSetValue);
              setOpen(false);
            }}
            className="mb-1.5 w-full border border-dashed border-gray-400 py-0.5 text-[11px] text-gray-700 hover:bg-gray-100"
          >
            {quickSetLabel}
          </button>

          {/* 색상 그리드 */}
          <div className="grid grid-cols-10 gap-px">
            {PRESET_COLORS.map((color, i) => (
              <button
                key={i}
                type="button"
                title={color}
                onMouseDown={(e) => applyPreset(color, e)}
                className="h-3.5 w-3.5 transition-transform hover:scale-125 hover:ring-1 hover:ring-gray-600 hover:ring-offset-0"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {/* 직접 선택 */}
          <div className="mt-1.5 border-t border-dashed border-gray-200 pt-1.5">
            <button
              type="button"
              className="w-full border border-dashed border-gray-400 py-0.5 text-[11px] text-gray-700 hover:bg-gray-100"
              onMouseDown={() => onBeforeCustomPick()}
              onClick={() => {
                setOpen(false);
                customInputRef.current?.click();
              }}
            >
              다른 색상 선택
            </button>
            <input
              ref={customInputRef}
              type="color"
              className="sr-only"
              value={safeColor}
              onChange={(e) => onChange(e.target.value)}
              onInput={(e) => onChange((e.target as HTMLInputElement).value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

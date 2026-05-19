"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchFollowedMentionCandidates,
  type MentionCandidate,
} from "@/lib/community/mentions";
import {
  findMentionTokenAfterSelection,
  findMentionTokenBeforeSelection,
  getCaretRectInEditor,
  getContentEditableCaretOffset,
  getMentionTrigger,
  rebuildEditorFromPlain,
  serializeContentEditable,
  setContentEditableCaretOffset,
} from "@/lib/community/mentionEditor";

type MenuPosition = {
  top: number;
  left: number;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  userId: string | null;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  className?: string;
  maxLength?: number;
  /** @deprecated 이름 유지 — contenteditable div ref */
  textareaRef?: React.RefObject<HTMLDivElement | null>;
  onFocus?: () => void;
  /** 외부 삽입 후 커서 복원 (스티커 등) */
  restoreCaret?: number | null;
  onRestoreCaret?: () => void;
  /** Ctrl+Enter / ⌘+Enter */
  onSubmitShortcut?: () => void;
};

export default function MentionTextarea({
  value,
  onChange,
  userId,
  disabled = false,
  placeholder,
  rows = 3,
  className = "",
  maxLength,
  textareaRef: externalRef,
  onFocus,
  restoreCaret = null,
  onRestoreCaret,
  onSubmitShortcut,
}: Props) {
  const router = useRouter();
  const internalRef = useRef<HTMLDivElement | null>(null);
  const editorRef = externalRef ?? internalRef;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const skipRebuildRef = useRef(false);
  const isComposingRef = useRef(false);

  const [candidates, setCandidates] = useState<MentionCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [trigger, setTrigger] = useState<ReturnType<typeof getMentionTrigger>>(null);
  const [caretIndex, setCaretIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const lastQueryRef = useRef<string | null>(null);
  /** React value 반영 전 타이핑 구간에서 플레이스홀더가 겹치지 않도록 */
  const [editorHasContent, setEditorHasContent] = useState(() => Boolean(value.trim()));

  const showPlaceholder = Boolean(placeholder) && !value.trim() && !editorHasContent;

  useEffect(() => {
    if (!value.trim()) setEditorHasContent(false);
  }, [value]);

  const handleMap = useMemo(
    () => new Map(candidates.map((row) => [row.handle.toLowerCase(), row])),
    [candidates],
  );

  useEffect(() => {
    if (!userId) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    setLoadingCandidates(true);
    void fetchFollowedMentionCandidates(userId).then((rows) => {
      if (!cancelled) {
        setCandidates(rows);
        setLoadingCandidates(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const filtered = useMemo(() => {
    if (!trigger) return [];
    const q = trigger.query.toLowerCase();
    if (!q) return candidates.slice(0, 8);
    return candidates
      .filter(
        (row) =>
          row.handle.toLowerCase().includes(q) ||
          row.label.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [candidates, trigger]);

  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = serializeContentEditable(editor);
    setEditorHasContent(Boolean(next.trim()));
    skipRebuildRef.current = true;
    onChange(maxLength ? next.slice(0, maxLength) : next);
  }, [editorRef, maxLength, onChange]);

  const syncFromEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = serializeContentEditable(editor);
    const cursor = getContentEditableCaretOffset(editor);
    setCaretIndex(cursor);
    setTrigger(getMentionTrigger(text, cursor));
    emitChange();
  }, [editorRef, emitChange]);

  useEffect(() => {
    if (skipRebuildRef.current) {
      skipRebuildRef.current = false;
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    const current = serializeContentEditable(editor);
    if (current === value) return;
    rebuildEditorFromPlain(editor, value, handleMap);

    if (restoreCaret != null) {
      requestAnimationFrame(() => {
        setContentEditableCaretOffset(editor, restoreCaret);
        editor.focus();
        onRestoreCaret?.();
      });
    }
  }, [value, handleMap, editorRef, restoreCaret, onRestoreCaret]);

  const updateMenuPosition = useCallback(() => {
    const editor = editorRef.current;
    const wrapper = wrapperRef.current;
    if (!editor || !wrapper || !trigger) {
      setMenuPosition(null);
      return;
    }
    const caretRect = getCaretRectInEditor(editor);
    if (!caretRect) {
      setMenuPosition(null);
      return;
    }
    const wrapperRect = wrapper.getBoundingClientRect();
    const menuHeight = 208;
    const belowTop = caretRect.bottom - wrapperRect.top + 4;
    const showAbove =
      caretRect.bottom + menuHeight > window.innerHeight &&
      caretRect.top - wrapperRect.top > menuHeight;
    setMenuPosition({
      top: showAbove ? caretRect.top - wrapperRect.top - menuHeight - 4 : belowTop,
      left: Math.max(0, caretRect.left - wrapperRect.left),
    });
  }, [editorRef, trigger]);

  useLayoutEffect(() => {
    updateMenuPosition();
  }, [updateMenuPosition, value, filtered.length, caretIndex]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const onScroll = () => updateMenuPosition();
    editor.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onScroll);
    return () => {
      editor.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [editorRef, updateMenuPosition]);

  useEffect(() => {
    if (!trigger) {
      lastQueryRef.current = null;
      setActiveIndex(-1);
      return;
    }
    const q = trigger.query;
    if (lastQueryRef.current !== q) {
      lastQueryRef.current = q;
      setActiveIndex(-1);
    }
  }, [trigger]);

  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length > 0 ? filtered.length - 1 : -1);
    }
  }, [activeIndex, filtered.length]);

  const applyMention = useCallback(
    (row: MentionCandidate) => {
      if (!trigger) return;
      const editor = editorRef.current;
      if (!editor) return;

      const before = value.slice(0, trigger.replaceStart);
      const after = value.slice(trigger.replaceEnd);
      const insert = `@${row.handle} `;
      const next = `${before}${insert}${after}`;
      const cursor = before.length + insert.length;

      skipRebuildRef.current = true;
      onChange(maxLength ? next.slice(0, maxLength) : next);
      rebuildEditorFromPlain(editor, maxLength ? next.slice(0, maxLength) : next, handleMap);
      setTrigger(null);
      setActiveIndex(-1);

      requestAnimationFrame(() => {
        editor.focus();
        setContentEditableCaretOffset(editor, cursor);
      });
    },
    [handleMap, maxLength, onChange, editorRef, trigger, value],
  );

  const selectActiveMention = useCallback(() => {
    if (filtered.length === 0) return;
    const index = activeIndex >= 0 ? activeIndex : 0;
    applyMention(filtered[index]);
  }, [activeIndex, applyMention, filtered]);

  const removeMentionToken = useCallback(
    (token: HTMLElement) => {
      const editor = editorRef.current;
      if (!editor) return;
      token.remove();
      syncFromEditor();
      editor.focus();
    },
    [editorRef, syncFromEditor],
  );

  const showMenu = Boolean(trigger && userId);

  const minHeightPx = Math.max(rows * 24, 60);

  return (
    <div ref={wrapperRef} className="relative">
        {showPlaceholder ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 whitespace-pre-wrap text-gray-500"
            style={{ minHeight: minHeightPx }}
          >
            {placeholder}
          </div>
        ) : null}

        <div
          ref={editorRef}
          role="textbox"
          aria-multiline
          aria-placeholder={placeholder}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={() => {
            if (isComposingRef.current) return;
            syncFromEditor();
          }}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
            syncFromEditor();
          }}
          onFocus={() => onFocus?.()}
          onClick={(event) => {
            const target = event.target as HTMLElement;
            const handle = target.closest<HTMLElement>("[data-mention-handle]")?.dataset
              .mentionHandle;
            if (handle) {
              event.preventDefault();
              router.push(`/user/${encodeURIComponent(handle)}`);
              return;
            }
            syncFromEditor();
          }}
          onKeyUp={() => syncFromEditor()}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (event.ctrlKey || event.metaKey) &&
              onSubmitShortcut
            ) {
              event.preventDefault();
              onSubmitShortcut();
              return;
            }

            if (event.key === "Backspace") {
              const token = findMentionTokenBeforeSelection();
              if (token) {
                event.preventDefault();
                removeMentionToken(token);
                return;
              }
            }
            if (event.key === "Delete") {
              const token = findMentionTokenAfterSelection();
              if (token) {
                event.preventDefault();
                removeMentionToken(token);
                return;
              }
            }

            if (showMenu && filtered.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => {
                  if (index < 0) return 0;
                  return (index + 1) % filtered.length;
                });
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => {
                  if (index < 0) return filtered.length - 1;
                  return (index - 1 + filtered.length) % filtered.length;
                });
                return;
              }
              if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
                event.preventDefault();
                selectActiveMention();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setTrigger(null);
                setActiveIndex(-1);
                return;
              }
            }
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setTrigger(null);
              setActiveIndex(-1);
            }, 150);
          }}
          onScroll={() => updateMenuPosition()}
          className={`${className} relative z-10 outline-none`}
          style={{ minHeight: minHeightPx }}
        />

        {showMenu && menuPosition ? (
          <ul
            ref={listRef}
            style={{
              position: "absolute",
              top: menuPosition.top,
              left: menuPosition.left,
              minWidth: "min(280px, 100%)",
              zIndex: 40,
            }}
            className="max-h-52 overflow-y-auto border border-dashed border-gray-400 bg-white py-1 shadow-md"
            onMouseDown={(event) => event.preventDefault()}
          >
            {loadingCandidates ? (
              <li className="px-3 py-2 text-xs text-gray-500">팔로우 목록 불러오는 중…</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-500">
                {candidates.length === 0
                  ? "팔로우한 계정이 없어요."
                  : "일치하는 계정이 없어요."}
              </li>
            ) : (
              filtered.map((row, index) => {
                const isActive = index === activeIndex;
                return (
                  <li key={row.userId}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                        isActive ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : "hover:bg-blue-50"
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        applyMention(row);
                      }}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-gray-300 bg-gray-50 text-[10px] font-bold text-gray-500">
                        {row.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          row.label.slice(0, 1)
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-gray-900">{row.label}</span>
                        <span className="block truncate text-xs text-blue-600">@{row.handle}</span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
    </div>
  );
}

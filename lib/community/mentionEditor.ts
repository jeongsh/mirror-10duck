import type { MentionCandidate } from "@/lib/community/mentions";

const HANDLE_BODY = /[A-Za-z0-9_][A-Za-z0-9_.-]{0,29}/;

export type MentionTrigger = {
  query: string;
  replaceStart: number;
  replaceEnd: number;
};

export function getMentionTrigger(text: string, cursor: number): MentionTrigger | null {
  const before = text.slice(0, cursor);
  const match = before.match(/(?:^|[^\w])@([\w.-]*)$/);
  if (!match || match.index === undefined) return null;
  const atIndex = before.lastIndexOf("@");
  return {
    query: match[1] ?? "",
    replaceStart: atIndex,
    replaceEnd: cursor,
  };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildMentionTokenElement(row: MentionCandidate): HTMLSpanElement {
  const span = document.createElement("span");
  span.setAttribute("data-mention-handle", row.handle);
  span.setAttribute("data-mention-user-id", row.userId);
  span.setAttribute("contenteditable", "false");
  span.className =
    "mention-token inline cursor-pointer rounded-sm bg-blue-50 px-0.5 font-semibold text-blue-600 hover:underline";
  span.textContent = `@${row.label}`;
  return span;
}

export function serializeContentEditable(root: HTMLElement): string {
  let out = "";

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }
    if (!(node instanceof HTMLElement)) return;

    if (node.dataset.mentionHandle) {
      out += `@${node.dataset.mentionHandle} `;
      return;
    }

    if (node.tagName === "BR") {
      out += "\n";
      return;
    }

    if (node.tagName === "DIV" || node.tagName === "P") {
      const parent = node.parentElement;
      if (parent && parent !== root && node.previousSibling) {
        out += "\n";
      }
      node.childNodes.forEach(walk);
      return;
    }

    node.childNodes.forEach(walk);
  };

  root.childNodes.forEach(walk);
  return out;
}

function mentionSerializedLength(handle: string): number {
  return `@${handle} `.length;
}

function walkSerializedLengthUntil(
  root: HTMLElement,
  endContainer: Node,
  endOffset: number,
): number {
  let total = 0;
  let done = false;

  const visit = (node: Node): void => {
    if (done) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (node === endContainer) {
        total += endOffset;
        done = true;
        return;
      }
      total += text.length;
      return;
    }

    if (!(node instanceof HTMLElement)) return;

    if (node.dataset.mentionHandle) {
      if (node === endContainer) {
        done = true;
        return;
      }
      total += mentionSerializedLength(node.dataset.mentionHandle);
      return;
    }

    if (node.tagName === "BR") {
      if (node === endContainer) {
        done = true;
        return;
      }
      total += 1;
      return;
    }

    if (node.tagName === "DIV" || node.tagName === "P") {
      const parent = node.parentElement;
      if (parent && parent !== root && node.previousSibling) {
        total += 1;
      }
    }

    for (const child of Array.from(node.childNodes)) {
      visit(child);
      if (done) return;
    }
  };

  for (const child of Array.from(root.childNodes)) {
    visit(child);
    if (done) break;
  }

  return total;
}

export function getContentEditableCaretOffset(root: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  return walkSerializedLengthUntil(root, range.endContainer, range.endOffset);
}

export function setContentEditableCaretOffset(root: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;

  let remaining = offset;
  let placed = false;

  const placeAt = (node: Node, nodeOffset: number) => {
    const range = document.createRange();
    range.setStart(node, nodeOffset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    placed = true;
  };

  const visit = (node: Node): void => {
    if (placed) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (remaining <= text.length) {
        placeAt(node, remaining);
        return;
      }
      remaining -= text.length;
      return;
    }

    if (!(node instanceof HTMLElement)) return;

    if (node.dataset.mentionHandle) {
      const len = mentionSerializedLength(node.dataset.mentionHandle);
      if (remaining <= len) {
        const after = node.nextSibling;
        if (after?.nodeType === Node.TEXT_NODE) {
          placeAt(after, 0);
        } else {
          placeAt(node.parentNode ?? root, Array.from(node.parentNode?.childNodes ?? []).indexOf(node) + 1);
        }
        return;
      }
      remaining -= len;
      return;
    }

    if (node.tagName === "BR") {
      if (remaining <= 1) {
        placeAt(node.parentNode ?? root, Array.from(node.parentNode?.childNodes ?? []).indexOf(node) + 1);
        return;
      }
      remaining -= 1;
      return;
    }

    if (node.tagName === "DIV" || node.tagName === "P") {
      const parent = node.parentElement;
      if (parent && parent !== root && node.previousSibling) {
        if (remaining <= 1) {
          placeAt(node, 0);
          return;
        }
        remaining -= 1;
      }
    }

    for (const child of Array.from(node.childNodes)) {
      visit(child);
      if (placed) return;
    }
  };

  for (const child of Array.from(root.childNodes)) {
    visit(child);
    if (placed) break;
  }

  if (!placed) {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

export function getCaretRectInEditor(editor: HTMLElement): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);

  const rects = range.getClientRects();
  if (rects.length > 0) return rects[0];

  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  range.insertNode(marker);
  const rect = marker.getBoundingClientRect();
  marker.remove();
  return rect;
}

export function rebuildEditorFromPlain(
  editor: HTMLElement,
  plain: string,
  handleMap: Map<string, MentionCandidate>,
) {
  editor.innerHTML = "";

  if (!plain) return;

  const pattern = new RegExp(`@(${HANDLE_BODY.source})(?=\\s|$|[.,!?])`, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(plain)) !== null) {
    const handle = match[1];
    const start = match.index;
    if (start > lastIndex) {
      editor.append(document.createTextNode(plain.slice(lastIndex, start)));
    }

    const row = handleMap.get(handle.toLowerCase());
    if (row) {
      editor.append(buildMentionTokenElement(row));
      const after = plain[start + match[0].length];
      if (after === " ") {
        editor.append(document.createTextNode(" "));
        lastIndex = start + match[0].length + 1;
      } else {
        lastIndex = start + match[0].length;
      }
    } else {
      editor.append(document.createTextNode(plain.slice(start, start + match[0].length)));
      lastIndex = start + match[0].length;
    }
  }

  if (lastIndex < plain.length) {
    editor.append(document.createTextNode(plain.slice(lastIndex)));
  }
}

export function findMentionTokenAfterSelection(): HTMLElement | null {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return null;

  const { startContainer, startOffset } = selection.getRangeAt(0);

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const text = startContainer.textContent ?? "";
    if (startOffset < text.length) return null;
    const next = startContainer.nextSibling;
    if (next instanceof HTMLElement && next.dataset.mentionHandle) return next;
  }

  if (startContainer.nodeType === Node.ELEMENT_NODE) {
    const el = startContainer as HTMLElement;
    const child = el.childNodes[startOffset];
    if (child instanceof HTMLElement && child.dataset.mentionHandle) return child;
  }

  return null;
}

export function findMentionTokenBeforeSelection(): HTMLElement | null {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return null;

  const { startContainer, startOffset } = selection.getRangeAt(0);

  if (startContainer instanceof HTMLElement && startContainer.dataset.mentionHandle) {
    return startContainer;
  }

  if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
    const prev = startContainer.previousSibling;
    if (prev instanceof HTMLElement && prev.dataset.mentionHandle) return prev;
  }

  if (startContainer.nodeType === Node.ELEMENT_NODE) {
    const el = startContainer as HTMLElement;
    const child = el.childNodes[startOffset - 1];
    if (child instanceof HTMLElement && child.dataset.mentionHandle) return child;
  }

  return null;
}

/** 본문 표시용: 텍스트를 멘션 링크 단위로 분리 */
export type MentionTextPart =
  | { type: "text"; value: string }
  | { type: "mention"; handle: string };

export function splitMentionText(text: string): MentionTextPart[] {
  if (!text) return [];
  const parts: MentionTextPart[] = [];
  const pattern = new RegExp(`@(${HANDLE_BODY.source})(?=\\s|$|[.,!?])`, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "mention", handle: match[1] });
    lastIndex = match.index + match[0].length;
    if (text[lastIndex] === " ") lastIndex += 1;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

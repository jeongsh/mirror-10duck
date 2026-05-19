/** textarea 커서 위치를 픽셀 좌표로 변환 (멘션 드롭다운 위치용). */
export function getTextareaCaretCoordinates(
  element: HTMLTextAreaElement,
  position: number,
): { top: number; left: number; lineHeight: number } {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  const mirror = document.createElement("div");
  mirror.setAttribute("aria-hidden", "true");
  mirror.style.position = "fixed";
  mirror.style.top = `${rect.top}px`;
  mirror.style.left = `${rect.left}px`;
  mirror.style.width = `${rect.width}px`;
  mirror.style.height = `${rect.height}px`;
  mirror.style.overflow = "hidden";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.zIndex = "-1";

  const props = [
    "boxSizing",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "textTransform",
    "textIndent",
    "lineHeight",
  ] as const;

  for (const prop of props) {
    mirror.style[prop] = style[prop];
  }

  mirror.scrollTop = element.scrollTop;
  mirror.scrollLeft = element.scrollLeft;

  const textBefore = element.value.slice(0, position);
  const textAfter = element.value.slice(position) || ".";

  mirror.textContent = "";
  mirror.append(document.createTextNode(textBefore));
  const marker = document.createElement("span");
  marker.textContent = textAfter[0] ?? ".";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();
  document.body.removeChild(mirror);

  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.4 || 20;

  return {
    top: markerRect.top - rect.top,
    left: markerRect.left - rect.left,
    lineHeight,
  };
}

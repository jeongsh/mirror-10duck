/**
 * textarea 의 현재 커서 위치(또는 선택 영역)에 텍스트를 삽입하고
 * 새 문자열과 갱신된 커서 위치를 함께 돌려준다.
 *
 * - 호출부에서 React state(`setContent`) 와 `selectionStart` 동기화에 사용한다.
 * - 호출 후 textarea 에 다시 포커스를 주면 사용자 입력 흐름이 끊기지 않는다.
 */
export interface InsertResult {
  next: string;
  cursor: number;
}

export function insertAtTextarea(
  textarea: HTMLTextAreaElement | null,
  current: string,
  text: string,
): InsertResult {
  if (!textarea) {
    const next = `${current}${text}`;
    return { next, cursor: next.length };
  }

  const start = textarea.selectionStart ?? current.length;
  const end = textarea.selectionEnd ?? current.length;

  const next = `${current.slice(0, start)}${text}${current.slice(end)}`;
  return { next, cursor: start + text.length };
}

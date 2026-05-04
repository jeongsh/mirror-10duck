import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import CharacterSticker from '@/components/stickers/CharacterSticker';

/**
 * 스티커를 위한 Tiptap 커스텀 노드 확장.
 * 본문의 :sticker/characterId/emotion: 패턴을 인식하여 React 컴포넌트로 렌더링한다.
 */
export const StickerExtension = Node.create({
  name: 'sticker',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      characterId: {
        default: null,
      },
      emotion: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-sticker]',
        getAttrs: (element) => {
          if (typeof element === 'string') return null;
          return {
            characterId: element.getAttribute('data-character-id'),
            emotion: element.getAttribute('data-emotion'),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-sticker': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer((props) => {
      const { characterId, emotion } = props.node.attrs;
      return (
        <span className="mx-1 inline-block align-middle outline-none">
          <CharacterSticker 
            token={{
              characterId,
              emotion,
              raw: `:sticker/${characterId}/${emotion}:`,
            }}
            size="md" 
          />
        </span>
      );
    });
  },
});

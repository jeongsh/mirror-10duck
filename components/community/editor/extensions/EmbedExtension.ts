import { Node, mergeAttributes } from '@tiptap/core';

export const EmbedExtension = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: {
        default: null,
      },
      type: {
        default: 'generic', // 'twitter', 'instagram', 'generic'
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-embed-url]',
        getAttrs: (element) => {
          if (typeof element === 'string') return null;
          return {
            url: element.getAttribute('data-embed-url'),
            type: element.getAttribute('data-embed-type'),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-embed-url': HTMLAttributes.url, 'data-embed-type': HTMLAttributes.type }), 'Embed Content'];
  },
});

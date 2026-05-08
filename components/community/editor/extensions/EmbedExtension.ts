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
    const baseAttrs = {
      'data-embed-url': HTMLAttributes.url,
      'data-embed-type': HTMLAttributes.type,
    };

    if (HTMLAttributes.type === 'twitter') {
      const attrs = mergeAttributes(HTMLAttributes, {
        ...baseAttrs,
        class: 'embed-block my-4',
      });

      return [
        'div',
        attrs,
        ['blockquote', { class: 'twitter-tweet' }, ['a', { href: HTMLAttributes.url }, HTMLAttributes.url || 'X post']],
      ];
    }

    if (HTMLAttributes.type === 'instagram') {
      const attrs = mergeAttributes(HTMLAttributes, {
        ...baseAttrs,
        class: 'embed-block my-4',
      });
      return [
        'div',
        attrs,
        [
          'blockquote',
          {
            class: 'instagram-media',
            'data-instgrm-permalink': HTMLAttributes.url,
            'data-instgrm-version': '14',
          },
          ['a', { href: HTMLAttributes.url }, HTMLAttributes.url || 'Instagram post'],
        ],
      ];
    }

    const attrs = mergeAttributes(HTMLAttributes, {
      ...baseAttrs,
      class: 'embed-block my-4 rounded border border-dashed border-gray-400 bg-gray-50 p-3',
    });

    return [
      'div',
      attrs,
      ['a', { href: HTMLAttributes.url, target: '_blank', rel: 'noopener noreferrer' }, HTMLAttributes.url || 'Embedded link'],
    ];
  },
});

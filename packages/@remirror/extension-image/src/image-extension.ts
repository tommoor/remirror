import {
  ApplySchemaAttributes,
  bool,
  Cast,
  CommandFunction,
  CreateExtensionPlugin,
  delayedCommand,
  DelayedValue,
  EditorView,
  ErrorConstant,
  extension,
  ExtensionTag,
  invariant,
  isArray,
  isElementDomNode,
  NodeAttributes,
  NodeExtension,
  NodeExtensionSpec,
  NodeWithAttributes,
  omitExtraAttributes,
  RemirrorError,
} from '@remirror/core';
import type { ResolvedPos } from '@remirror/pm/model';
import { PasteRule } from '@remirror/pm/paste-rules';

type DelayedImage = DelayedValue<ImageAttributes>;

export interface ImageOptions {
  createPlaceholder?: (view: EditorView, pos: number) => HTMLElement;
  updatePlaceholder?: (
    view: EditorView,
    pos: number,
    element: HTMLElement,
    progress: number,
  ) => void;
  destroyPlaceholder?: (view: EditorView, element: HTMLElement) => void;

  /**
   * The upload handler for the image extension.
   *
   * It receives a list of dropped or pasted files and returns a promise for the
   * attributes which should be used to insert the image into the editor.
   *
   * @param files - a list of files to upload.
   * @param setProgress - the progress handler.
   */
  uploadHandler?: (files: FileWithProgress[]) => DelayedImage[];
}

interface FileWithProgress {
  file: File;
  progress: SetProgress;
}

/**
 * Set the progress.
 *
 * @param progress - a value between `0` and `1`.
 */
type SetProgress = (progress: number) => void;

/**
 * The image extension for placing images into your editor.
 *
 * TODO ->
 * - Captions https://glitch.com/edit/#!/pet-figcaption?path=index.js%3A27%3A1 into a preset
 * - Resizable https://glitch.com/edit/#!/toothsome-shoemaker?path=index.js%3A1%3A0
 */
@extension<ImageOptions>({
  defaultOptions: {
    createPlaceholder,
    updatePlaceholder: () => {},
    destroyPlaceholder: () => {},
    uploadHandler,
  },
})
export class ImageExtension extends NodeExtension<ImageOptions> {
  get name() {
    return 'image' as const;
  }

  createTags() {
    return [ExtensionTag.InlineNode, ExtensionTag.Media];
  }

  createNodeSpec(extra: ApplySchemaAttributes): NodeExtensionSpec {
    return {
      inline: true,
      attrs: {
        ...extra.defaults(),
        alt: { default: '' },
        crop: { default: null },
        height: { default: null },
        width: { default: null },
        rotate: { default: null },
        src: { default: null },
        title: { default: '' },
        fileName: { default: null },
      },
      draggable: true,
      selectable: false,
      parseDOM: [
        {
          tag: 'img[src]',
          getAttrs: (element) =>
            isElementDomNode(element) ? getImageAttributes({ element, parse: extra.parse }) : {},
        },
      ],
      toDOM: (node) => {
        const attrs = omitExtraAttributes(node.attrs, extra);
        return ['img', { ...extra.dom(node), ...attrs }];
      },
    };
  }

  createCommands() {
    const commands = {
      insertImage: (attributes: ImageAttributes, position?: number): CommandFunction => ({
        tr,
        dispatch,
      }) => {
        const { selection } = tr;
        position = position ?? selection.head;
        const node = this.type.create(attributes);

        dispatch?.(tr.insert(position, node));

        return true;
      },

      /**
       * Insert an image once the provide promise resolves.
       */
      uploadImage: (value: DelayedValue<ImageAttributes>): CommandFunction => {
        return delayedCommand({
          promise: value,
          immediate: (parameter) => {
            const { empty, anchor } = parameter.tr.selection;
            const { createPlaceholder, updatePlaceholder, destroyPlaceholder } = this.options;

            return this.store.commands.addPlaceholder.original(
              value,
              {
                type: 'widget',
                pos: anchor,
                createElement: (view, pos) => {
                  return createPlaceholder(view, pos);
                },
                onUpdate: (view, pos, element, data) => {
                  updatePlaceholder(view, pos, element, data);
                },
                onDestroy: (view, element) => {
                  destroyPlaceholder(view, element);
                },
              },
              !empty,
            )(parameter);
          },
          onDone: ({ value, ...rest }) => {
            const range = this.store.helpers.findPlaceholder(value);

            if (!range) {
              return false;
            }

            this.store.chain.removePlaceholder(value).insertImage(value, range.from).run();

            return true;
          },
          // Cleanup in case of an error.
          onFail: (parameter) => this.store.commands.removePlaceholder.original(value)(parameter),
        });
      },
    };

    return commands;
  }

  private fileUploadHandler(files: File[]) {
    const { commands, chain } = this.store;
    const filesWithProgress: FileWithProgress[] = files.map((file, index) => ({
      file,
      progress: (progress) => {
        commands.updatePlaceholder(uploads[index], progress);
      },
    }));

    const uploads = this.options.uploadHandler(filesWithProgress);

    for (const upload of uploads) {
      chain.uploadImage(upload);
    }

    chain.run();

    return true;
  }

  createPasteRules(): PasteRule[] {
    return [
      {
        type: 'file',
        regexp: /image/i,
        fileHandler: ({ files }) => this.fileUploadHandler(files),
      },
    ];
  }
}

type ImageAttributes = NodeAttributes<ImageExtensionAttributes>;

export interface ImageExtensionAttributes {
  align?: 'center' | 'end' | 'justify' | 'left' | 'match-parent' | 'right' | 'start';
  alt?: string;
  crop?: {
    width: number;
    height: number;
    left: number;
    top: number;
  };
  height?: string;
  width?: string;
  rotate?: string;
  src?: string;
  title?: string;
  /** The file name used to create the image. */
  fileName?: string;
}

/**
 * Values which can safely be ignored when styling nodes.
 */
const EMPTY_CSS_VALUE = new Set(['', '0%', '0pt', '0px']);
const CSS_ROTATE_PATTERN = /rotate\(([\d.]+)rad\)/i;

/**
 * The set of valid image files.
 */
const IMAGE_FILE_TYPES = new Set([
  'image/jpeg',
  'image/gif',
  'image/png',
  'image/jpg',
  'image/svg',
  'image/webp',
]);

/**
 * True when the provided file is an image file.
 */
export function isImageFileType(file: File) {
  return IMAGE_FILE_TYPES.has(file.type);
}

/**
 * Get the alignment of the text in the element.
 */
function getAlignment(element: HTMLElement) {
  const { cssFloat, display } = element.style;

  let align = element.getAttribute('data-align') ?? element.getAttribute('align');

  if (align) {
    align = /(left|right|center)/.test(align) ? align : null;
  } else if (cssFloat === 'left' && !display) {
    align = 'left';
  } else if (cssFloat === 'right' && !display) {
    align = 'right';
  } else if (!cssFloat && display === 'block') {
    align = 'block';
  }

  return align;
}

/**
 * Get the width and the height of the image.
 */
function getDimensions(element: HTMLElement) {
  let { width, height } = element.style;
  width = width ?? element.getAttribute('width') ?? '';
  height = height ?? element.getAttribute('height') ?? '';

  return { width, height };
}

/**
 * Get the rotation of the image from the parent element.
 */
function getRotation(element: HTMLElement) {
  const { parentElement } = element;

  if (!isElementDomNode(parentElement)) {
    return null;
  }

  if (!parentElement.style.transform) {
    return null;
  }

  // example text to match: `rotate(1.57rad) translateZ(0px)`;
  const matchingPattern = parentElement.style.transform.match(CSS_ROTATE_PATTERN);

  if (!matchingPattern?.[1]) {
    return null;
  }

  return Number.parseFloat(matchingPattern[1]) || null;
}

/**
 * Retrieve attributes from the dom for the image extension.
 */
function getImageAttributes({
  element,
  parse,
}: {
  element: HTMLElement;
  parse: ApplySchemaAttributes['parse'];
}) {
  const { width, height } = getDimensions(element);

  return {
    ...parse(element),
    alt: element.getAttribute('alt') ?? null,
    height: Number.parseInt(height || '0', 10) || null,
    src: element.getAttribute('src') ?? null,
    title: element.getAttribute('title') ?? null,
    width: Number.parseInt(width || '0', 10) || null,
    fileName: element.getAttribute('data-file-name') ?? null,
  };
}

function setImageAttributes(node: NodeWithAttributes<ImageAttributes>) {}

function hasCursor<T extends object>(argument: T): argument is T & { $cursor: ResolvedPos } {
  return bool(Cast(argument).$cursor);
}

function createBlockImageSpec() {}

function createInlineImageSpec() {}

function createPlaceholder(view: EditorView, pos: number): HTMLElement {
  const element = document.createElement('div');
  element.classList.add(loaderClass);

  return element;
}

/**
 * The default handler converts the files into their `base64` representations
 * and adds the attributes before inserting them into the editor.
 */
function uploadHandler(files: FileWithProgress[]): DelayedImage[] {
  invariant(files.length >= 1, {
    code: ErrorConstant.EXTENSION,
    message: 'The upload handler was applied for the image extension without any valid files',
  });

  let completed = 0;
  const promises: Array<Promise<ImageAttributes>> = [];

  for (const { file, progress } of files) {
    promises.push(
      new Promise<ImageAttributes>((resolve) => {
        const reader = new FileReader();

        reader.addEventListener(
          'load',
          (readerEvent) => {
            completed += 1;
            progress(1);
            resolve({ src: readerEvent.target?.result as string, fileName: file.name });
          },
          { once: true },
        );

        reader.readAsDataURL(file);
      }),
    );
  }

  return promises;
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      image: ImageExtension;
    }

    interface BaseExtension {
      /**
       * Awesome stuff
       */
      a: string;
    }
  }
}

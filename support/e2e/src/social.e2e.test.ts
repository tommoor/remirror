import { getDocument, queries } from 'playwright-testing-library';
import { ElementHandle } from 'playwright-testing-library/dist/typedefs';

import { EDITOR_CLASS_SELECTOR } from '@remirror/core';

import {
  $innerHtml,
  goto,
  innerHtml,
  outerHtml,
  press,
  sel,
  skipTestOnFirefox,
  textContent,
  type,
} from './helpers';

const FIRST_PARAGRAPH_SELECTOR = `${EDITOR_CLASS_SELECTOR} > p:first-child`;

const { getByRole } = queries;
const path = __SERVER__.urls.social.empty;

describe('Social Showcase', () => {
  let $document: ElementHandle;
  let $editor: ElementHandle;

  beforeEach(async () => {
    await goto(path);
    $document = await getDocument(page);
    $editor = await getByRole($document, 'textbox');
  });

  describe('Links', () => {
    it('should have a social editor', async () => {
      await $editor.focus();
      await $editor.type('This is text https://url.com');
      await expect($innerHtml(FIRST_PARAGRAPH_SELECTOR)).resolves.toMatchSnapshot();
    });

    it('should parse simple urls', async () => {
      await $editor.type('url.com');
      await expect($innerHtml(FIRST_PARAGRAPH_SELECTOR)).resolves.toMatchSnapshot();
      await press({ key: 'Backspace' });
      await expect($innerHtml(FIRST_PARAGRAPH_SELECTOR)).resolves.toMatchSnapshot();
      await press({ key: 'Backspace' });
      await expect(innerHtml(FIRST_PARAGRAPH_SELECTOR)).resolves.toBe(`url.c`);

      await type({ text: 'o.uk' });
      await expect($innerHtml(FIRST_PARAGRAPH_SELECTOR)).resolves.toMatchSnapshot();
    });

    // TODO The 'Home' key press doesn't work on Firefox
    skipTestOnFirefox('can handle more complex interactions', async () => {
      await $editor.type('this is the first url.com');
      await press({ key: 'Enter' });
      await $editor.type('this.com is test.com');
      await press({ key: 'Home' }); // ? This does nothing on Firefox
      await type({ text: 'split.com ' });
      // eslint-disable-next-line jest/no-standalone-expect
      await expect($innerHtml(FIRST_PARAGRAPH_SELECTOR)).resolves.toMatchSnapshot();

      await press({ key: 'ArrowUp' });
      await press({ key: 'End' });
      await press({ key: 'Backspace', count: 2 });
      await type({ text: '..no .co more url please' });
      // eslint-disable-next-line jest/no-standalone-expect
      await expect(innerHtml(FIRST_PARAGRAPH_SELECTOR)).resolves.toBe(
        `this is the first url.c..no .co more url please`,
      );
    });

    it('should handle the enter key', async () => {
      await $editor.type('this is the first url.com');
      await press({ key: 'ArrowLeft', count: 3 });
      await press({ key: 'Enter' });

      await expect(innerHtml(FIRST_PARAGRAPH_SELECTOR)).resolves.toBe(`this is the first url.`);
    });

    it('should not contain false positives', async () => {
      await $editor.type('https://localhost:3000/ahttps://meowni.ca');
      await expect(innerHtml(FIRST_PARAGRAPH_SELECTOR)).resolves.toBe(
        `https://localhost:3000/ahttps://meowni.ca`,
      );
    });
  });

  describe('Mentions', () => {
    it('should not allow mixing the tags', async () => {
      await $editor.type('@#ab #@simple ');
      await expect(outerHtml(sel(EDITOR_CLASS_SELECTOR, 'a'))).rejects.toThrow();
    });

    describe('@', () => {
      it('should wrap in progress mentions in a-tag decorations', async () => {
        await $editor.type('Hello @jonathan');
        await expect(textContent(sel(EDITOR_CLASS_SELECTOR, '.suggest-at'))).resolves.toBe(
          '@jonathan',
        );
      });

      it('should not trap the arrow keys', async () => {
        await $editor.type('@a');
        await press({ key: 'ArrowLeft', count: 2 });

        await $editor.type('12 ');
        await expect($editor.innerHTML()).resolves.toMatchSnapshot();
      });

      it('should not revert the mention', async () => {
        const selector = sel(EDITOR_CLASS_SELECTOR, '.mention-at');
        await $editor.type('@a ');
        await press({ key: 'ArrowLeft' });

        await $editor.type(' ');
        await expect(textContent(selector)).resolves.toBe('@a');
      });

      it('should accept selections onEnter', async () => {
        const selector = sel(EDITOR_CLASS_SELECTOR, '.mention-at');

        await $editor.type('hello @ab');
        await press({ key: 'Enter' });
        await expect(page.$$(selector)).resolves.toHaveLength(1);
        await expect(textContent(selector)).resolves.toBe('@orangefish879'); // This might change if data changes
      });

      it('should still wrap selections when exiting without selections', async () => {
        await $editor.type('hello @ab ');
        await expect(textContent(sel(EDITOR_CLASS_SELECTOR, '.mention-at'))).resolves.toBe('@ab');
      });

      it('allows clicking on suggestions', async () => {
        const selector = '.remirror-mention-suggestions-item.highlighted';
        await $editor.type('hello @alex');

        await page.click(selector);
        await expect(textContent(sel(EDITOR_CLASS_SELECTOR, '.mention-at'))).resolves.toBe(
          '@lazymeercat594',
        );
        await expect(textContent(EDITOR_CLASS_SELECTOR)).resolves.toBe(`hello @lazymeercat594 `);
      });

      it('allows arrowing between suggesters', async () => {
        await $editor.type('hello  1');
        await press({ key: 'ArrowLeft', count: 2 });
        await $editor.type('@ab');
        await press({ key: 'ArrowRight' });
        await expect(textContent(sel(EDITOR_CLASS_SELECTOR, '.mention-at'))).resolves.toBe('@ab');
      });

      it('allows arrowing between suggesters and breaking up the suggestion', async () => {
        await $editor.type('hello  1');
        await press({ key: 'ArrowLeft' });
        await $editor.type('@ab ');
        await expect(textContent(sel(EDITOR_CLASS_SELECTOR, '.mention-at'))).resolves.toBe('@ab');
      });

      it('handles arrowing between arrowing back into mention without errors', async () => {
        await $editor.type('@ab ');
        await press({ key: 'ArrowLeft', count: 4 });
        await press({ key: 'ArrowRight' });
        await expect(textContent(sel(EDITOR_CLASS_SELECTOR, '.mention-at'))).resolves.toBe('@ab');
      });

      it('removes mark when no partial query', async () => {
        await $editor.type('@abc ');
        await press({ key: 'ArrowLeft', count: 4 });
        await $editor.type(' ');
        await expect(
          textContent(sel(EDITOR_CLASS_SELECTOR, '.mention-at')),
        ).rejects.toThrowErrorMatchingInlineSnapshot(
          `"page.$eval: Error: failed to find element matching selector \\".remirror-editor .mention-at\\""`,
        );
      });

      it('adds the mark when enter is pressed', async () => {
        const username = '@abcd1234';
        await $editor.type(username);
        await press({ key: 'Enter' });
        await expect(textContent(sel(EDITOR_CLASS_SELECTOR, '.mention-at'))).resolves.toBe(
          username,
        );
      });

      it('splits up the mark when enter is pressed', async () => {
        const username = '@abcd1234 ';
        await $editor.type(username);
        await press({ key: 'ArrowLeft', count: 3 });
        await press({ key: 'Enter' });
        await expect(textContent(sel(EDITOR_CLASS_SELECTOR, '.mention-at'))).resolves.toBe(
          '@abcd12',
        );
      });

      it('removes mentions for forward deletes', async () => {
        await $editor.type('@abc ');
        await press({ key: 'ArrowLeft', count: 5 });
        await press({ key: 'Delete' });
        await expect(
          textContent(sel(EDITOR_CLASS_SELECTOR, '.mention-at')),
        ).rejects.toThrowErrorMatchingInlineSnapshot(
          `"page.$eval: Error: failed to find element matching selector \\".remirror-editor .mention-at\\""`,
        );
      });

      it('can exit when selecting text', async () => {
        await $editor.type('@abc ');
        await press({ key: 'ArrowLeft', count: 1 });
        await page.keyboard.down('Shift');
        await press({ key: 'ArrowLeft', count: 4 });
        await page.keyboard.up('Shift');
        await press({ key: 'ArrowLeft', count: 1 });
        await $editor.type('Awesome ');

        await expect(textContent(sel(EDITOR_CLASS_SELECTOR, '.mention-at'))).resolves.toBe('@abc');
        await expect(textContent(sel(EDITOR_CLASS_SELECTOR))).resolves.toBe('Awesome @abc ');
      });

      it('only replaces the selected text in a mention', async () => {
        await $editor.type('@abc ');
        await press({ key: 'ArrowLeft', count: 2 });
        await page.keyboard.down('Shift');
        await press({ key: 'ArrowLeft', count: 3 });
        await page.keyboard.up('Shift');
        await $editor.type('d');

        await expect(textContent(sel(EDITOR_CLASS_SELECTOR))).resolves.toBe('dc ');
      });
    });

    describe('#', () => {
      it('should wrap in progress mentions in a-tag decorations', async () => {
        await $editor.type('My tag is #Topic');
        await expect(textContent(sel(EDITOR_CLASS_SELECTOR, '.suggest-tag'))).resolves.toBe(
          '#Topic',
        );
      });

      it('should accept selections onEnter', async () => {
        const selector = sel(EDITOR_CLASS_SELECTOR, '.mention-tag');

        await $editor.type('hello #T');
        await press({ key: 'Enter' });
        await expect(page.$$(selector)).resolves.toHaveLength(1);
        await expect(textContent(selector)).resolves.toBe('#Tags');
      });

      it('should still wrap selections when exiting without selections', async () => {
        await $editor.type('hello #T ');
        await expect(textContent(sel(EDITOR_CLASS_SELECTOR, '.mention-tag'))).resolves.toBe('#T');
      });

      it('allows clicking on suggesters', async () => {
        const selector = '.remirror-mention-suggestions-item.highlighted';
        await $editor.type('My #T');
        await page.click(selector);
        await expect(textContent(sel(EDITOR_CLASS_SELECTOR, '.mention-tag'))).resolves.toBe(
          '#Tags',
        );
        await expect(textContent(EDITOR_CLASS_SELECTOR)).resolves.toBe(`My #Tags `);
      });
    });
  });

  describe('Emoji', () => {
    // Emoji are being completely rewritten soon so this is temporary
    it('should be able to add emoji', async () => {
      await $editor.type('😀', { delay: 10 });
      await expect(innerHtml(sel(EDITOR_CLASS_SELECTOR, 'p'))).resolves.toBe(`😀`);
    });

    it('transforms emoticons', async () => {
      await $editor.type(':-) hello', { delay: 10 });
      await expect(innerHtml(FIRST_PARAGRAPH_SELECTOR)).resolves.toBe(`😃 hello`);
    });

    it('transforms colon emojis', async () => {
      await $editor.type(':heart:', { delay: 10 });
      await expect(innerHtml(FIRST_PARAGRAPH_SELECTOR)).resolves.toBe(`❤️`);
    });

    it('should handle multiple emoji with no spaces', async () => {
      const text = '123abcXYZ';
      await $editor.type('😀😀😀😀', { delay: 10 });
      await press({ key: 'ArrowLeft', count: 2 });
      await press({ key: 'ArrowRight' });
      await type({ text });
      await expect(textContent(FIRST_PARAGRAPH_SELECTOR)).resolves.toBe(`😀😀😀123abcXYZ😀`);
    });
  });

  describe('Combined Emoji, Mentions and AutoLinks', () => {
    it('should combine mentions emoji and links', async () => {
      await $editor.type('#awesome hello @ab 😀 google.com', { delay: 10 });
      await press({ key: 'Enter' });
      await expect($innerHtml(FIRST_PARAGRAPH_SELECTOR)).resolves.toMatchSnapshot();
    });

    it('should not replace emoji with link when no space between', async () => {
      await $editor.type('😀google.com', { delay: 10 });
      await press({ key: 'Enter' });
      await expect($innerHtml(FIRST_PARAGRAPH_SELECTOR)).resolves.toMatchSnapshot();
    });
  });
});

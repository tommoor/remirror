import { FC, useEffect } from 'react';
import { LinkExtension, LinkOptions } from 'remirror/extensions';
import { Remirror, useRemirror, useRemirrorContext } from 'remirror/react';

export default { title: 'Link extension' };

const SmallEditor: FC = () => {
  const { getRootProps, setContent, commands } = useRemirrorContext();

  useEffect(() => {
    setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'www.remirror.io',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://www.remirror.io',
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  }, [setContent, commands]);

  return <div {...getRootProps()} />;
};

export const Basic = (args: LinkOptions): JSX.Element => {
  const { manager, state } = useRemirror({ extensions: () => [new LinkExtension(args)] });

  return (
    <Remirror manager={manager} initialContent={state}>
      <SmallEditor />
    </Remirror>
  );
};

Basic.args = {
  autoLink: true,
  openLinkOnClick: true,
};

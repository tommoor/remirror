import { FC, useEffect, useMemo } from 'react';
import { AnnotationExtension, createCenteredAnnotationPositioner } from 'remirror/extensions';
import { Remirror, usePositioner, useRemirror, useRemirrorContext } from 'remirror/react';

export default { title: 'Editor with annotation' };

const SAMPLE_TEXT = 'This is a sample text';

const Popup: FC = () => {
  const { helpers, getState } = useRemirrorContext({ autoUpdate: true });

  const memoizedPositioner = useMemo(
    () => createCenteredAnnotationPositioner(helpers.getAnnotationsAt),
    [helpers],
  );
  const positioner = usePositioner(memoizedPositioner);

  if (!positioner.active) {
    return null;
  }

  const sel = getState().selection;
  const annotations = helpers.getAnnotationsAt(sel.from);
  const label = annotations.map((annotation) => annotation.text).join('\n');

  return (
    <div
      style={{
        top: positioner.bottom,
        left: positioner.left,
        position: 'absolute',
        border: '1px solid black',
        whiteSpace: 'pre-line',
      }}
      ref={positioner.ref}
    >
      {label}
    </div>
  );
};

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
              text: `${SAMPLE_TEXT} `,
            },
          ],
        },
      ],
    });
    commands.setAnnotations([
      {
        id: 'a-1',
        from: 1,
        to: SAMPLE_TEXT.length + 1,
      },
      {
        id: 'a-2',
        from: 9,
        to: SAMPLE_TEXT.length + 1,
      },
      {
        id: 'a-3',
        from: 11,
        to: 17,
      },
    ]);
  }, [setContent, commands]);

  return (
    <div>
      <div {...getRootProps()} />
      <Popup />
    </div>
  );
};

export const Basic = () => {
  const { manager } = useRemirror({ extensions: () => [new AnnotationExtension()] });

  return (
    <Remirror manager={manager}>
      <SmallEditor />
    </Remirror>
  );
};

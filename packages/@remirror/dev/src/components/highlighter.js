import styled from '@emotion/styled';
import React from 'react';

import theme from '../dev-theme';

const CustomPre = styled('pre')({
  padding: '9px 0 18px 0 !important',
  margin: 0,
  color: theme.white80,
  '& .prosemirror-dev-tools-highlighter-tag': {
    color: theme.main,
  },
});
CustomPre.displayName = 'CustomPre';

const regexp = /(&lt;\/?[\s\w"'=]+&gt;)/gim;
const highlight = (str) =>
  str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(regexp, "<span class='prosemirror-dev-tools-highlighter-tag'>$&</span>");

export class Highlighter extends React.Component {
  render() {
    if (!this.props.children) {
      return null;
    }

    return (
      <CustomPre
        dangerouslySetInnerHTML={{
          __html: highlight(this.props.children),
        }}
      />
    );
  }
}

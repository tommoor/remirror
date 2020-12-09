import type * as _ from '@emotion/react';
import styled from '@emotion/styled';

import theme from '../dev-theme';

export const Heading = styled.h2`
  color: ${theme.softerMain};
  padding: 0;
  margin: 0;
  font-weight: 400;
  letter-spacing: 1px;
  font-size: 13px;
  text-transform: uppercase;
  flex-grow: 1;
`;

export const HeadingWithButton = styled.div`
  display: flex;
`;

export const HeadingButton = styled.button`
  padding: 6px 10px;
  margin: -6px -10px 0 8px;
  font-weight: 400;
  letter-spacing: 1px;
  font-size: 11px;
  color: ${theme.white80};
  text-transform: uppercase;
  transition: background 0.3s, color 0.3s;
  border-radius: 2px;
  border: none;
  background: transparent;

  &:hover {
    background: ${theme.main40};
    color: ${theme.white};
    cursor: pointer;
  }

  &:focus {
    outline: none;
  }

  &:active {
    background: ${theme.main60};
  }
`;

export const CssReset = styled.div`
  font-size: 100%;
  line-height: 1;

  & li + li {
    margin: 0;
  }
`;

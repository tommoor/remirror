import { createContext, FC, useContext, useState } from 'react';

type TabName = 'state' | '';

interface GlobalContext {
  opened: boolean;
  tabIndex: TabName;
  defaultSize: number;
  toggleDevTools: () => void;
  selectTab: (tabName: TabName) => void;
}

const defaultContext: GlobalContext = {
  opened: false,
  tabIndex: 'state',
  defaultSize: 0.5,
  toggleDevTools() {},
  selectTab() {},
};

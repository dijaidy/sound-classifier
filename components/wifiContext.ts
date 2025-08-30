// sheet-ref-context.ts
import React from 'react';

// 핵심: RefObject<BottomSheetModal | null> | null  (둘 다 null 허용)
export const WifiContext =
  React.createContext<{
    confirmedWifi: string;
    setConfirmedWifi: React.Dispatch<React.SetStateAction<string>>;
    eventNameArr: string[];
    setEventNameArr: React.Dispatch<React.SetStateAction<string[]>>;
  }|null>(null);
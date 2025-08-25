// sheet-ref-context.ts
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import React from 'react';

// 핵심: RefObject<BottomSheetModal | null> | null  (둘 다 null 허용)
export const SheetRefContext =
  React.createContext<{
    bottomSheetModalRef: React.RefObject<BottomSheetModal | null>;
    localAudioArr: string[];
    setLocalAudioArr: React.Dispatch<React.SetStateAction<string[]>>
  }|null>(null);
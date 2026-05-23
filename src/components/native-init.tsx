'use client';

import { useEffect } from 'react';

export function NativeInit() {
  useEffect(() => {
    import('@/lib/native').then(({ initNativeServices }) => {
      initNativeServices().catch((err: unknown) => {
        console.warn('[NativeInit] Failed to initialize native services:', err);
      });
    });
  }, []);

  return null;
}

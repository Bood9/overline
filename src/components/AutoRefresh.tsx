'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Pull fresh server-rendered data while a match is in play. */
export default function AutoRefresh({ seconds = 60, enabled = true }: { seconds?: number; enabled?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [seconds, enabled, router]);
  return null;
}

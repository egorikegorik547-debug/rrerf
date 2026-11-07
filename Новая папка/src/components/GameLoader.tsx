'use client';

import dynamic from 'next/dynamic';

const GameApp = dynamic(() => import('./GameApp'), {
  ssr: false,
  loading: () => (
    <div className="grid h-screen w-screen place-items-center bg-black font-mono text-sm uppercase tracking-[0.4em] text-stone-500">Загрузка…</div>
  ),
});

export default function GameLoader() {
  return <GameApp />;
}

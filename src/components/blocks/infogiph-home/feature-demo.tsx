import type { FeatureCard } from './types';

export function FeatureDemo({ demo }: { demo: FeatureCard['demo'] }) {
  switch (demo) {
    case 'designer':
      return (
        <div className="absolute inset-0 bg-gradient-to-br from-[#e9ecff] via-[#ead9ff] to-[#f3e0e7] flex items-center justify-center p-6">
          <div className="grid grid-cols-3 gap-2 w-full">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-md bg-white/80 backdrop-blur border border-white shadow-sm flex items-center justify-center"
              >
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#8ca0ff] to-[#b89bff] opacity-80" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'typeface':
      return (
        <div className="absolute inset-0 bg-black flex items-center justify-center p-4 overflow-hidden">
          <span className="text-white font-black text-3xl sm:text-5xl tracking-tight">
            Info<span className="text-[#f5c84b]">giph</span>
          </span>
        </div>
      );
    case 'text':
      return (
        <div className="absolute inset-0 bg-[#f5f5f5] flex items-center justify-center p-5">
          <div className="flex flex-col items-start gap-1.5">
            {['TEXT', 'TO', 'DIAGRAM'].map((w, i) => (
              <span
                key={w}
                className="font-black text-2xl sm:text-4xl leading-none"
                style={{
                  transform: `translateX(${i * 16}px)`,
                  color: i === 1 ? '#ef4444' : '#0a0a0a',
                }}
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      );
    case 'graphics':
      return (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0ea5e9] to-[#7c3aed] flex items-center justify-center">
          <svg viewBox="0 0 160 90" className="w-full h-full p-6">
            {[0, 1, 2, 3].map((i) => (
              <circle
                key={i}
                cx="80"
                cy="45"
                r={10 + i * 10}
                fill="none"
                stroke="white"
                strokeOpacity={0.8 - i * 0.15}
                strokeWidth="1.5"
              />
            ))}
          </svg>
        </div>
      );
    case 'animator':
      return (
        <div className="absolute inset-0 bg-[#111] flex items-center justify-center">
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-[#f5c84b] to-[#e63946] ig-bounce-soft" />
        </div>
      );
    case 'social':
    default:
      return (
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-rose-400 to-orange-400 flex items-center justify-center gap-3 p-5">
          <div className="h-20 w-14 rounded-xl bg-white/90 shadow-lg rotate-[-6deg]" />
          <div className="h-24 w-16 rounded-xl bg-white shadow-lg" />
          <div className="h-20 w-14 rounded-xl bg-white/90 shadow-lg rotate-[6deg]" />
        </div>
      );
  }
}

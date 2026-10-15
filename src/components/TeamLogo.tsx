/* eslint-disable @next/next/no-img-element */
export default function TeamLogo({ src, alt, size = 40 }: { src?: string | null; alt: string; size?: number }) {
  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-white/5 text-[10px] font-bold text-mute"
        style={{ width: size, height: size }}
      >
        {alt.slice(0, 3).toUpperCase()}
      </div>
    );
  }
  return <img src={src} alt={alt} width={size} height={size} className="object-contain" style={{ width: size, height: size }} loading="lazy" />;
}

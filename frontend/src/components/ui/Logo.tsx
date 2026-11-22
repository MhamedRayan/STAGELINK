import logoUrl from '@/assets/LOGOstagelink.png';
import { cn } from '@/lib/cn';

// Figma: a 38 px tile (radius 10, #F8FFF9) with the 41 px logo image laid over it, 1 px up-left.
const SIZES = {
  md: { box: 41, tile: 38, offset: 1 },
  sm: { box: 32, tile: 30, offset: 1 },
} as const;

/** STAGLINK mark: logo image on a rounded off-white tile (src/assets/LOGOstagelink.png). */
export function Logo({ size = 'md', className }: { size?: keyof typeof SIZES; className?: string }) {
  const { box, tile, offset } = SIZES[size];
  return (
    <span
      className={cn('relative inline-block shrink-0', className)}
      style={{ width: box, height: box }}
    >
      <span
        aria-hidden="true"
        className="absolute rounded-[10px] bg-canvas"
        style={{ left: offset, top: offset, width: tile, height: tile }}
      />
      <img
        src={logoUrl}
        alt="STAGLINK"
        width={box}
        height={box}
        className="relative block object-contain"
      />
    </span>
  );
}

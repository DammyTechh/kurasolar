import { cn } from '@/lib/cn';

interface IconProps {
  /** A Material Symbols Rounded name, e.g. "check_circle". See fonts.google.com/icons. */
  name: string;
  /** Solid rather than outlined. Reserve it for selected or active states. */
  filled?: boolean;
  /** Pixel size. Defaults to 20, which matches `text-sm` and `text-base` lines. */
  size?: 16 | 20 | 24 | 32;
  className?: string;
  /** Set when the icon carries meaning on its own; otherwise it stays hidden from screen readers. */
  label?: string;
}

/**
 * Material Symbols Rounded, rendered as a ligature.
 *
 *   <Icon name="bolt" />
 *   <Icon name="check_circle" filled className="text-success" />
 *
 * The icon inherits colour from its parent, so never set a colour here that the
 * surrounding text does not already use.
 */
export function Icon({ name, filled, size = 20, className, label }: IconProps) {
  return (
    <span
      className={cn('icon', filled && 'icon-filled', className)}
      style={size === 20 ? undefined : { fontSize: `${size}px` }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      translate="no"
    >
      {name}
    </span>
  );
}

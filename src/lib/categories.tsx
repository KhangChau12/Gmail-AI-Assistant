import {
  Bell,
  Briefcase,
  Code2,
  GraduationCap,
  Heart,
  Newspaper,
  Plane,
  ShoppingCart,
  Star,
  Tag,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryColor, CategoryIcon } from './types';

const ICONS: Record<CategoryIcon, LucideIcon> = {
  briefcase: Briefcase,
  school: GraduationCap,
  wallet: Wallet,
  newspaper: Newspaper,
  bell: Bell,
  heart: Heart,
  user: User,
  tag: Tag,
  plane: Plane,
  cart: ShoppingCart,
  code: Code2,
  star: Star,
};

/** CSS colour for a category palette key; `alpha` gives the tinted background used behind icons. */
export function catColor(color: CategoryColor | undefined, alpha = 1): string {
  return `rgb(var(--c-${color ?? 'indigo'}) / ${alpha})`;
}

export function CategoryGlyph({ icon, className }: { icon: CategoryIcon; className?: string }) {
  const Icon = ICONS[icon] ?? Tag;
  return <Icon className={className} aria-hidden />;
}

/** Rounded square with the category's icon on a tinted background — the visual anchor of tiles and headers. */
export function CategoryBadge({ icon, color, size = 42 }: { icon: CategoryIcon; color: CategoryColor; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.29, background: catColor(color, 0.16), color: catColor(color) }}
    >
      <CategoryGlyph icon={icon} className="size-[48%]" />
    </span>
  );
}

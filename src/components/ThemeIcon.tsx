import {
  Atom,
  BookOpen,
  Briefcase,
  Building2,
  ChefHat,
  Clapperboard,
  Cpu,
  Crown,
  Dna,
  Gamepad2,
  Globe,
  HeartPulse,
  Joystick,
  Landmark,
  Music,
  Palette,
  Puzzle,
  Shapes,
  Shuffle,
  Sigma,
  Sparkles,
  Swords,
  Trees,
  Trophy,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Mapa seguro: só ícones conhecidos; nomes desconhecidos caem no fallback. */
const ICONS: Record<string, LucideIcon> = {
  Atom,
  BookOpen,
  Briefcase,
  Building2,
  ChefHat,
  Clapperboard,
  Cpu,
  Crown,
  Dna,
  Gamepad2,
  Globe,
  Globe2: Globe,
  HeartPulse,
  Joystick,
  Landmark,
  Music,
  Palette,
  Puzzle,
  Shapes,
  Shuffle,
  Sigma,
  Sparkles,
  Swords,
  Trees,
  Trophy,
  UtensilsCrossed,
  Zap,
};

export function resolveIcon(name: string | undefined): LucideIcon {
  if (name && Object.prototype.hasOwnProperty.call(ICONS, name)) return ICONS[name];
  return Shapes;
}

interface Props {
  name: string | undefined;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ThemeIcon({ name, size = 22, strokeWidth = 1.8, className }: Props) {
  const Icon = resolveIcon(name);
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}

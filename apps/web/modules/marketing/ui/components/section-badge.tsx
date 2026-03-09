interface SectionBadgeProps {
  number: string;
  label: string;
  sub: string;
  center?: boolean;
}

export const SectionBadge = ({ number, label, sub, center }: SectionBadgeProps) => (
  <div className={`flex items-center gap-3 mb-4 text-xs text-muted-foreground font-mono uppercase tracking-widest ${center ? "justify-center" : ""}`}>
    <span className="text-primary">[ {number} ]</span>
    <span>·</span>
    <span>{label}</span>
    <span className="text-muted-foreground/40">//</span>
    <span>{sub}</span>
  </div>
);

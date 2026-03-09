const CornerSvg = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="22"
    height="21"
    viewBox="0 0 22 21"
    fill="none"
  >
    <path
      d="M10.5 4C10.5 7.31371 7.81371 10 4.5 10H0.5V0H10.5V4Z"
      className="fill-border"
    />
    <path
      d="M11.5 4C11.5 7.31371 14.1863 10 17.5 10H21.5V0H11.5V4Z"
      className="fill-border"
    />
  </svg>
);

interface FrameBoxProps {
  children: React.ReactNode;
  className?: string;
  corners?: "top" | "bottom" | "both" | "none";
}

export const FrameBox = ({
  children,
  className = "",
  corners = "bottom",
}: FrameBoxProps) => (
  <div className={`relative ${className}`}>
    {/* Vertical frame lines */}
    <div className="absolute top-0 left-0 w-px h-full bg-border" />
    <div className="absolute top-0 right-0 w-px h-full bg-border" />

    {/* Top horizontal line */}
    {(corners === "top" || corners === "both") && (
      <>
        <div className="absolute top-0 left-0 w-full h-px bg-border" />
        <CornerSvg className="absolute -top-[10.5px] -left-[10.5px] rotate-180" />
        <CornerSvg className="absolute -top-[10.5px] -right-[10.5px] rotate-180" />
      </>
    )}

    {/* Bottom horizontal line */}
    {(corners === "bottom" || corners === "both") && (
      <>
        <div className="absolute bottom-0 left-0 w-full h-px bg-border" />
        <CornerSvg className="absolute -bottom-[10.5px] -left-[10.5px]" />
        <CornerSvg className="absolute -bottom-[10.5px] -right-[10.5px]" />
      </>
    )}

    {children}
  </div>
);

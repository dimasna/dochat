const logos = [
  "TechFlow",
  "Meridian",
  "CloudBase",
  "NovaStar",
  "Axiom",
  "PeakVenture",
  "Lumina",
  "Vantage",
  "Cortex",
  "Parallax",
  "Nimbus",
  "Arcadia",
  "Helix",
  "Quantum",
  "Polaris",
];

export const LogoCloud = () => (
  <section className="border-y border-border">
    <div className="max-w-[1160px] mx-auto px-6 py-3">
      <p className="text-center text-sm text-muted-foreground mt-4">
        Trusted by{" "}
        <strong className="text-foreground">1,000+</strong> teams worldwide
      </p>
      <div className="overflow-x-clip py-6">
        <div
          className="flex gap-12 w-max"
          style={{ animation: "marquee 25s linear infinite" }}
        >
          {[...logos, ...logos].map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="text-base font-semibold text-muted-foreground/30 whitespace-nowrap tracking-wide hover:text-muted-foreground/60 transition-colors"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  </section>
);

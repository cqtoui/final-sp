export default function BrandLogo({ compact = false }) {
  return (
    <img
      src="/actvet-ats-logo.png?v=3"
      alt="ACTVET / Applied Technology Schools"
      title="ACTVET / Applied Technology Schools"
      className={
        compact
          ? "h-12 w-auto max-w-[200px] object-contain object-right"
          : "h-16 w-auto max-w-[260px] object-contain object-right"
      }
      draggable={false}
    />
  );
}

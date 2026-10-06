import { cn } from "@/lib/utils";

export default function BrandMark({ className, alt = "AI SafeGuard" }) {
  return (
    <img
      src="/ai-safeguard-icon.png?v=2"
      alt={alt}
      title="AI SafeGuard"
      className={cn("object-contain object-center", className)}
      draggable={false}
    />
  );
}

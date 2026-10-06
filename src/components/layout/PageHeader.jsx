import { cn } from "@/lib/utils";
import BrandLogo from "./BrandLogo";

export default function PageHeader({ title, subtitle, children, className }) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-border/70 pb-5 sm:mb-7 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
        {children}
        <BrandLogo />
      </div>
    </div>
  );
}

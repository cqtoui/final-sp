import { Link } from "react-router-dom";

export default function PageNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center">
        <p className="text-6xl font-light text-muted-foreground/40">404</p>
        <div className="mx-auto mt-3 h-0.5 w-16 bg-border" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That address is not part of AI SafeGuard.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to Live Monitor
        </Link>
      </div>
    </div>
  );
}

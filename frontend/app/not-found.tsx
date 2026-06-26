import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="text-5xl font-bold text-accent">404</p>
      <h1 className="mt-3 text-lg font-semibold text-slate-100">
        Page not found
      </h1>
      <p className="mt-1 text-sm text-muted">
        The page you’re looking for doesn’t exist.
      </p>
      <Link
        href="/"
        className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-accent/90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

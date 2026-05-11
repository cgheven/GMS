import Link from "next/link";
import { ShieldOff } from "lucide-react";

export function Forbidden({ message }: { message?: string }) {
  return (
    <div className="px-4 py-16 flex flex-col items-center gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <ShieldOff className="w-7 h-7 text-amber-400" />
      </div>
      <p className="text-lg font-bold">Owner-only page</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        {message ?? "Your role doesn't have access to this page."}
      </p>
      <Link href="/dashboard" className="text-sm text-primary hover:underline mt-2">
        ← Back to Dashboard
      </Link>
    </div>
  );
}

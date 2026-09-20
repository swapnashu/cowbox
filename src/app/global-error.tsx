"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 bg-slate-50" role="alert">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-md w-full text-center flex flex-col items-center">
        <div className="h-12 w-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4" aria-hidden="true">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-500 mb-6">An unexpected error occurred. Please try again.</p>
        <Button
          onClick={() => reset()}
          className="bg-pink-600 hover:bg-pink-700 text-white font-medium"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}

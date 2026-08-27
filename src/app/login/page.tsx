"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    fetch("/api/auth/setup")
      .then((res) => res.json())
      .then((data) => setNeedsSetup(data.needsSetup))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (needsSetup) {
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setIsSubmitting(false);
          return;
        }

        const res = await fetch("/api/auth/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        if (res.ok) {
          router.push("/");
        } else {
          const data = await res.json();
          setError(data.message || "Failed to complete setup");
        }
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (res.ok) {
          router.push("/");
        } else {
          const data = await res.json();
          setError(data.message || "Invalid credentials");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-pink-500/20 text-white font-black text-3xl mb-4">
            🐮
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-pink-600 via-rose-600 to-emerald-600 bg-clip-text text-transparent flex items-center justify-center gap-2">
            Cowbox
          </h2>
          <p className="mt-2 text-sm font-semibold text-emerald-600 uppercase tracking-widest">
            Self-Hosted PaaS
          </p>
        </div>

        <Card className="border-0 shadow-xl bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-8">
            <h3 className="text-xl font-bold text-slate-900 mb-6 text-center">
              {needsSetup ? "Initial Admin Setup" : "Sign In to Cluster"}
            </h3>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-md flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {needsSetup && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                    Admin Name
                  </label>
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Super Admin"
                    className="bg-slate-50"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Email Address
                </label>
                <Input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@cowbox.local"
                  className="bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Password
                </label>
                <Input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-50"
                />
              </div>

              {needsSetup && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                    Confirm Password
                  </label>
                  <Input
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-slate-50"
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold h-11 mt-6 shadow-md shadow-pink-500/20"
              >
                <Lock className="h-4 w-4 mr-2" />
                {isSubmitting
                  ? "Please wait..."
                  : needsSetup
                  ? "Complete Setup"
                  : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

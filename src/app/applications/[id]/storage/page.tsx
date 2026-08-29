"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HardDrive, Plus, Save } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function StoragePage() {
  const params = useParams();
  const router = useRouter();
  const appId = params.id as string;
  
  const [volumeName, setVolumeName] = useState("");
  const [mountPath, setMountPath] = useState("/app/data");
  const [isSaving, setIsSaving] = useState(false);
  const [app, setApp] = useState<any>(null);
  
  useEffect(() => {
    fetch(`/api/applications/${appId}`).then(r => r.json()).then(setApp).catch(console.error);
  }, [appId]);

  const handleAttach = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await fetch(`/api/applications/${appId}/storage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volumeName, mountPath }),
      });
      // Handle success
      setVolumeName("");
      setMountPath("/app/data");
      alert("Volume attached successfully!");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!app) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <Link
          href={`/applications/${appId}`}
          className="text-xs font-semibold text-pink-600 hover:underline flex items-center gap-1.5 mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Application
        </Link>
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white flex items-center justify-center shadow-md shadow-pink-500/20 font-bold">
            <HardDrive className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Storage Volumes</h1>
            <div className="text-xs text-slate-500 mt-0.5">Manage persistent data for {app.name}</div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attach Volume</CardTitle>
          <CardDescription>Mount persistent Docker volumes to your application container.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAttach} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Volume Name</label>
              <Input
                placeholder="e.g. app_data"
                value={volumeName}
                onChange={(e) => setVolumeName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Mount Path</label>
              <Input
                placeholder="e.g. /app/data"
                value={mountPath}
                onChange={(e) => setMountPath(e.target.value)}
                required
              />
            </div>
            <Button type="submit" isLoading={isSaving} className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600">
              <Plus className="w-4 h-4 mr-2" />
              Attach Volume
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function DomainsPage() {
  const params = useParams();
  const appId = params.id as string;
  
  const [domain, setDomain] = useState("");
  const [httpsEnabled, setHttpsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [app, setApp] = useState<any>(null);
  
  useEffect(() => {
    fetch(`/api/applications/${appId}`).then(r => r.json()).then(setApp).catch(console.error);
  }, [appId]);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: appId, domain, https: httpsEnabled }),
      });
      setDomain("");
      setHttpsEnabled(true);
      alert("Domain added successfully!");
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
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Custom Domains</h1>
            <div className="text-xs text-slate-500 mt-0.5">Manage domains for {app.name}</div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Custom Domain</CardTitle>
          <CardDescription>Route external traffic to your application container.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddDomain} className="space-y-5 max-w-md">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Domain Name</label>
              <Input
                placeholder="e.g. api.mycompany.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
              />
            </div>
            
            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-slate-800">Enable HTTPS (Let's Encrypt)</div>
                <div className="text-xs text-slate-500">Automatically provision TLS certificates</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={httpsEnabled}
                  onChange={(e) => setHttpsEnabled(e.target.checked)}
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <Button type="submit" isLoading={isSaving} className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Domain
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

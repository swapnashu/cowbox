"use client";

import { Key, Terminal, Globe, Zap, ArrowRight, Server, PlayCircle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DocsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Terminal className="h-6 w-6 text-pink-500" />
            API Documentation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Automate deployments and manage your cluster programmatically.
          </p>
        </div>
        <Badge variant="outline" className="bg-pink-50 text-pink-600 border-pink-200 uppercase tracking-widest font-bold">
          v1 REST API
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 text-sm text-slate-600">
              <p>
                All API requests require an API key to be included in the headers. You can generate one in the <a href="/api-keys" className="text-pink-600 font-semibold hover:underline">API Keys</a> tab.
              </p>
              <div className="bg-slate-900 rounded-xl p-4 text-emerald-400 font-mono text-xs overflow-x-auto shadow-inner">
                Authorization: Bearer cbx_live_...
              </div>
              <p>Or alternatively:</p>
              <div className="bg-slate-900 rounded-xl p-4 text-emerald-400 font-mono text-xs overflow-x-auto shadow-inner">
                X-API-Key: cbx_live_...
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <Globe className="h-4 w-4 text-blue-500" />
                Base URL
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 text-sm text-slate-600">
              <p>If self-hosting Cowbox on a remote server, use your server's IP address and port 9999.</p>
              <div className="bg-slate-900 rounded-xl p-4 text-blue-400 font-mono text-xs overflow-x-auto shadow-inner">
                http://&lt;your-server-ip&gt;:9999/api/v1
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200/60 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 border-b border-slate-100">
              <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded text-xs tracking-wider">POST</span>
              <span className="font-mono text-sm font-semibold text-slate-700">/api/v1/deploy</span>
            </div>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Trigger Deployment</h3>
              <p className="text-sm text-slate-600 mb-6">
                Programmatically trigger a new deployment for an existing application, or create a brand new application on the fly.
              </p>

              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Request Body (Existing App)</h4>
              <div className="bg-slate-900 rounded-xl p-4 text-emerald-400 font-mono text-xs overflow-x-auto shadow-inner mb-6">
                <pre>{`{
  "applicationId": "app_123456789"
}`}</pre>
              </div>

              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Request Body (Create New App)</h4>
              <div className="bg-slate-900 rounded-xl p-4 text-emerald-400 font-mono text-xs overflow-x-auto shadow-inner mb-6">
                <pre>{`{
  "appName": "my-api-service",
  "dockerImage": "nginx:alpine",
  "containerPort": 80,
  "envVars": "NODE_ENV=production\\nPORT=80"
}`}</pre>
              </div>

              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Example cURL</h4>
              <div className="bg-slate-900 rounded-xl p-4 text-emerald-400 font-mono text-xs overflow-x-auto shadow-inner">
                <pre>{`curl -X POST http://localhost:9999/api/v1/deploy \\
  -H "Authorization: Bearer cbx_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"applicationId": "app_123"}'`}</pre>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/60 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 border-b border-slate-100">
              <span className="bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded text-xs tracking-wider">POST</span>
              <span className="font-mono text-sm font-semibold text-slate-700">/api/webhooks/deploy/:appId</span>
            </div>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">GitHub / GitLab Webhook</h3>
              <p className="text-sm text-slate-600 mb-6">
                Used for Continuous Deployment (CD). Add this URL to your GitHub repository's Webhook settings. It automatically verifies GitHub's payload and triggers a redeployment when code is pushed to the configured branch.
              </p>
              
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Webhook URL</h4>
              <div className="bg-slate-900 rounded-xl p-4 text-emerald-400 font-mono text-xs overflow-x-auto shadow-inner">
                http://&lt;your-ip&gt;:9999/api/webhooks/deploy/&lt;application_id&gt;
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function PublicStatusPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/status/public")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Loading status...</div>;
  }

  const allOperational = data?.monitors?.every((m: any) => m.status === "up") ?? true;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <Activity className="h-12 w-12 text-pink-600 mx-auto mb-4" />
          <h1 className="text-3xl font-extrabold text-slate-900">System Status</h1>
          <p className="mt-2 text-slate-500">Real-time status of services and applications</p>
        </div>

        <div className={`p-6 rounded-xl border ${allOperational ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
          <div className="flex items-center gap-3">
            {allOperational ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            ) : (
              <AlertCircle className="h-8 w-8 text-rose-600" />
            )}
            <div>
              <h2 className={`text-xl font-bold ${allOperational ? "text-emerald-800" : "text-rose-800"}`}>
                {allOperational ? "All Systems Operational" : "Service Disruption"}
              </h2>
              <p className={`text-sm mt-1 ${allOperational ? "text-emerald-600" : "text-rose-600"}`}>
                As of {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Active Monitors</h3>
          {data?.monitors?.length === 0 ? (
            <Card className="p-8 text-center text-slate-500">No monitors configured.</Card>
          ) : (
            <div className="space-y-3">
              {data?.monitors?.map((monitor: any) => (
                <Card key={monitor.id} className="overflow-hidden">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`h-3 w-3 rounded-full ${monitor.status === "up" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                      <div>
                        <div className="font-bold text-slate-900">{monitor.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {monitor.responseTime || 0}ms response time
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-700">{monitor.uptimePercentage || "100"}%</div>
                      <div className="text-xs text-slate-500">Uptime</div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 flex">
                    {/* Dummy uptime bar rendering based on percentage */}
                    <div className="h-full bg-emerald-500" style={{ width: `${monitor.uptimePercentage || 100}%` }}></div>
                    <div className="h-full bg-rose-500" style={{ width: `${100 - (monitor.uptimePercentage || 100)}%` }}></div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {data?.incidents?.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Recent Incidents</h3>
            <div className="space-y-3">
              {data.incidents.map((inc: any) => (
                <Card key={inc.id} className="p-4">
                  <div className="font-bold text-slate-900">{inc.title}</div>
                  <div className="text-sm text-slate-600 mt-1">{inc.description}</div>
                  <div className="text-xs text-slate-400 mt-2">{new Date(inc.createdAt).toLocaleString()}</div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

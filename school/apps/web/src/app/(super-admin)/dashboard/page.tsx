"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Activity, Loader2, ShieldAlert, Users, Building2, Store } from "lucide-react";
import { z } from "zod";

interface Tenant {
  id: string;
  subdomain: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  plan: string;
  createdAt: string;
  usersCount?: number;
}

interface AuditLog {
  id: string;
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown | null;
  createdAt: string;
  tenant: {
    subdomain: string;
    name: string;
  };
}

const tenantSchema = z.object({
  id: z.string().uuid(),
  subdomain: z.string(),
  name: z.string(),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  plan: z.string(),
  createdAt: z.string(),
  usersCount: z.number().int().optional(),
});

const tenantsResponseSchema = z.array(tenantSchema);

const tenantStatusResponseSchema = z.object({
  success: z.boolean(),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

const auditLogSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  actorUserId: z.string().uuid(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  metadata: z.unknown().nullable().optional().transform((value) => value ?? null),
  createdAt: z.string(),
  tenant: z.object({
    subdomain: z.string(),
    name: z.string(),
  }),
});

const auditLogsResponseSchema = z.object({
  data: z.array(auditLogSchema),
  nextCursor: z.string().uuid().nullable(),
});

export default function SuperAdminDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);

  async function loadTenants() {
    setLoading(true);
    try {
      const res = await apiClient<Tenant[]>("/api/super-admin/tenants", {
        parse: (raw: unknown) => tenantsResponseSchema.parse(raw),
      });
      if (res.error) throw new Error(res.error);
      setTenants(res.data || []);
    } catch {
      toast.error("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditLogs() {
    setAuditLoading(true);
    try {
      const res = await apiClient<{ data: AuditLog[]; nextCursor: string | null }>("/api/super-admin/audit-logs", {
        parse: (raw: unknown) => auditLogsResponseSchema.parse(raw),
      });
      if (res.error) throw new Error(res.error);
      setAuditLogs(res.data?.data || []);
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadTenants();
      void loadAuditLogs();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function toggleStatus(tenantId: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      const res = await apiClient<{ success: boolean; status: string }>(`/api/super-admin/tenants/${tenantId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
        parse: (raw: unknown) => tenantStatusResponseSchema.parse(raw),
      });

      if (res.error) throw new Error(res.error);
      
      toast.success(`Tenant ${newStatus.toLowerCase()} successfully`);
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, status: newStatus as "ACTIVE" | "SUSPENDED" } : t));
      await loadAuditLogs();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Settings update failed");
    }
  }

  function formatAuditMetadata(metadata: unknown): string {
    if (typeof metadata !== "object" || metadata === null) {
      return "";
    }

    const previousStatus = "previousStatus" in metadata ? metadata.previousStatus : null;
    const newStatus = "newStatus" in metadata ? metadata.newStatus : null;

    if (typeof previousStatus === "string" && typeof newStatus === "string") {
      return `${previousStatus} -> ${newStatus}`;
    }

    return "";
  }

  if (loading) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center text-neutral-400">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Loading global data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-neutral-800/50 border border-neutral-700 p-6 rounded-xl">
          <div className="flex items-center gap-3 text-neutral-400 mb-2">
            <Building2 className="w-5 h-5" />
            <h3 className="font-medium">Total Campuses</h3>
          </div>
          <p className="text-3xl font-bold text-white">{tenants.length}</p>
        </div>
        <div className="bg-neutral-800/50 border border-neutral-700 p-6 rounded-xl">
          <div className="flex items-center gap-3 text-neutral-400 mb-2">
            <Users className="w-5 h-5" />
            <h3 className="font-medium">Global Users</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {tenants.reduce((acc, t) => acc + (t.usersCount || 0), 0)}
          </p>
        </div>
        <div className="bg-neutral-800/50 border border-neutral-700 p-6 rounded-xl">
          <div className="flex items-center gap-3 text-neutral-400 mb-2">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="font-medium">Suspended</h3>
          </div>
          <p className="text-3xl font-bold text-red-400">
            {tenants.filter(t => t.status === "SUSPENDED").length}
          </p>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-800/30 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Registered Tenants</h2>
          <Button variant="outline" size="sm" onClick={loadTenants} className="border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800">
            Refresh
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400">
              <tr>
                <th className="px-6 py-4 font-medium">Campus Name</th>
                <th className="px-6 py-4 font-medium">Domain (Tenant)</th>
                <th className="px-6 py-4 font-medium">Users</th>
                <th className="px-6 py-4 font-medium">Plan</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {tenants.map(tenant => (
                <tr key={tenant.id} className="hover:bg-neutral-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{tenant.name}</div>
                    <div className="text-neutral-500 text-xs">ID: {tenant.id.slice(0,8)}...</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700">
                      <Store className="w-3.5 h-3.5" />
                      {tenant.subdomain}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-neutral-300">
                    <div className="flex items-center gap-2">
                       <Users className="w-4 h-4 text-neutral-500" />
                       {tenant.usersCount}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {tenant.status === "ACTIVE" ? (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                        SUSPENDED
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      variant={tenant.status === "ACTIVE" ? "destructive" : "secondary"} 
                      size="sm"
                      onClick={() => toggleStatus(tenant.id, tenant.status)}
                      className={tenant.status !== "ACTIVE" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                    >
                      {tenant.status === "ACTIVE" ? "Suspend" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                    No tenants found in the database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-800/30 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-neutral-400" />
            <h2 className="text-lg font-semibold text-white">Recent Audit Logs</h2>
          </div>
          <Button variant="outline" size="sm" onClick={loadAuditLogs} className="border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800">
            Refresh
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400">
              <tr>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">Tenant</th>
                <th className="px-6 py-4 font-medium">Action</th>
                <th className="px-6 py-4 font-medium">Entity</th>
                <th className="px-6 py-4 font-medium">Details</th>
                <th className="px-6 py-4 font-medium">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {auditLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-neutral-500">
                    Loading audit logs...
                  </td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-neutral-500">
                    No audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-800/20 transition-colors">
                    <td className="px-6 py-4 text-neutral-300">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{log.tenant.name}</div>
                      <div className="text-neutral-500 text-xs">{log.tenant.subdomain}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-300">{log.entityType}</td>
                    <td className="px-6 py-4 text-neutral-300">{formatAuditMetadata(log.metadata)}</td>
                    <td className="px-6 py-4 text-neutral-500">{log.actorUserId.slice(0, 8)}...</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

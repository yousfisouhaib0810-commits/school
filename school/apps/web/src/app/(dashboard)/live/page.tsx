"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Plus, Video } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { z } from "zod";

interface SessionData {
  id: string;
  title: string;
  scheduledAt: string;
  isLive: boolean;
}

const sessionsResponseSchema = z.array(
  z.object({
    id: z.string().uuid(),
    title: z.string(),
    scheduledAt: z.string(),
    isLive: z.boolean(),
  })
);

export default function AdminLiveSessionsPage() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const loadSessions = async () => {
    try {
      const response = await apiClient<SessionData[]>("/api/live", {
        parse: (raw: unknown) => sessionsResponseSchema.parse(raw),
      });

      if (response.error) {
        toast.error(response.error);
        return;
      }
      setSessions(response.data || []);
    } catch {
      toast.error("Failed to load live sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !scheduledAt) return;
    
    const dateStr = new Date(scheduledAt).toISOString();

    try {
      const response = await apiClient("/api/live", {
        method: "POST",
        body: JSON.stringify({ title, scheduledAt: dateStr }),
      });

      if (response.error) {
         toast.error(response.error);
         return;
      }

      toast.success("Live session scheduled securely");
      setTitle("");
      setScheduledAt("");
      void loadSessions();
    } catch {
      toast.error("Failed to schedule session");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Live Sessions</h1>
        <p className="text-muted-foreground">Manage secure Jitsi Meet live sessions.</p>
      </div>

      <div className="bg-card border rounded-lg p-6 max-w-xl">
        <h2 className="text-lg font-semibold mb-4">Schedule New Session</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Topic / Title</label>
            <Input 
              placeholder="e.g. Intensive Math Revision" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Scheduled Date & Time</label>
            <Input 
              type="datetime-local" 
              value={scheduledAt} 
              onChange={(e) => setScheduledAt(e.target.value)} 
              required 
            />
          </div>
          <Button type="submit" className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Schedule Secure Jitsi Session
          </Button>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p>Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-muted-foreground">No sessions scheduled.</p>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="border rounded-lg p-4 bg-card flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-lg line-clamp-1">{session.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(session.scheduledAt), "PPpp")}
                </p>
                <div className="mt-4 flex items-center space-x-2 text-sm">
                  <span className={`px-2 py-1 rounded-md text-xs font-semibold ${session.isLive ? "bg-red-500/20 text-red-500" : "bg-neutral-800 text-neutral-400"}`}>
                    {session.isLive ? "LIVE NOW" : "SCHEDULED"}
                  </span>
                </div>
              </div>
              <div className="mt-6 flex space-x-2">
                <Button variant="secondary" className="w-full" onClick={() => {
                   navigator.clipboard.writeText(`${window.location.origin}/live/${session.id}`);
                   toast.success("Student link copied");
                }}>
                  <Copy className="h-4 w-4 mr-2" /> Share Link
                </Button>
                <Button className="w-full" asChild>
                  <a href={`/live/${session.id}`} target="_blank" rel="noopener noreferrer">
                    <Video className="h-4 w-4 mr-2" /> Start Host
                  </a>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

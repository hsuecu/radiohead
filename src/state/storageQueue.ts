import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StorageProvider } from "../types/storage";
import { getAdapter } from "../api/storage/adapter";
import { useStoragePolicy } from "./storagePolicy";
import { useAuditLog } from "./auditLog";
import { useStorageIndex } from "./storageIndex";
import { notificationManager } from "../utils/notifications";
import { smartQueueManager } from "../utils/smartQueue";
import { getAuth } from "../api/storage/oauth";

export type StorageJob = {
  id: string;
  provider: StorageProvider;
  localUri: string;
  remotePath: string;
  status: "pending" | "uploading" | "verifying" | "complete" | "failed" | "paused";
  progress: number;
  retries: number;
  error?: string | null;
};

export type StorageQueueState = {
  jobs: StorageJob[];
  enqueue: (j: StorageJob) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  remove: (id: string) => void;
  clearCompleted: () => void;
  pump: () => Promise<void>;
};

export const useStorageQueue = create<StorageQueueState>()(
  persist(
    (set, get) => ({
      jobs: [],
      enqueue: (j) => set((s) => ({ jobs: [j, ...s.jobs] })),
      pause: (id) => set((s) => ({ jobs: s.jobs.map(x => x.id === id ? { ...x, status: "paused" } : x) })),
      resume: (id) => set((s) => ({ jobs: s.jobs.map(x => x.id === id ? { ...x, status: "pending" } : x) })),
      remove: (id) => set((s) => ({ jobs: s.jobs.filter(x => x.id !== id) })),
      clearCompleted: () => set((s) => ({ jobs: s.jobs.filter(x => x.status !== "complete") })),
      pump: async () => {
        const state = get();
        
        // Check if uploads should be paused due to network conditions
        if (smartQueueManager.shouldPauseUploads()) {
          const networkInfo = smartQueueManager.getNetworkInfo();
          const reason = !networkInfo.isConnected ? 'No internet connection' : 'Cellular data uploads disabled';
          notificationManager.warning('Uploads Paused', reason);
          return;
        }
        
        const pendingJobs = state.jobs.filter(job => job.status === "pending");
        
        if (pendingJobs.length > 0) {
          notificationManager.queueProcessingStarted(pendingJobs.length);
        }
        
        // Optimize job order for better performance
        const optimizedJobs = smartQueueManager.optimizeJobOrder(pendingJobs);
        
        let successful = 0;
        let failed = 0;
        
        for (const job of optimizedJobs) {
          // Check if we can start another upload
          if (!smartQueueManager.canStartUpload()) {
            break; // Wait for current uploads to complete
          }
          
          const filename = job.remotePath.split('/').pop() || 'file';
          
          // Start the upload
          if (!smartQueueManager.startUpload()) {
            continue; // Skip if we can't start
          }
          
          try {
            const policy = useStoragePolicy.getState();
            if (!policy.allowedProviders.includes(job.provider)) throw new Error("PROVIDER_BLOCKED");

            // Verify auth before uploading
            let auth = await getAuth(job.provider);
            // Refresh if token is near expiry (within 30s)
            if (auth?.expiresAt && auth.expiresAt < Date.now() + 30000) {
              try {
                const { refreshAuth } = await import("../api/storage/oauth");
                auth = await refreshAuth(job.provider) || auth;
              } catch {}
            }
            if (!auth?.accessToken) {
              set((s) => ({ jobs: s.jobs.map(x => x.id === job.id ? { ...x, status: "failed", error: `Not connected to ${job.provider}` } : x) }));
              notificationManager.uploadFailed(filename, `Not connected to ${job.provider}`);
              failed++;
              continue;
            }
            const ad = await getAdapter(job.provider);
            try { await ad.init(auth as any); } catch (e: any) {
              const emsg = String(e?.message || e || "Init failed");
              set((s) => ({ jobs: s.jobs.map(x => x.id === job.id ? { ...x, status: "failed", error: `Verification failed: ${emsg}` } : x) }));
              notificationManager.uploadFailed(filename, `Verification failed: ${emsg}`);
              failed++;
              continue;
            }
            
            // Notify upload started
            notificationManager.uploadStarted(filename, job.provider);
            
            set((s) => ({ jobs: s.jobs.map(x => x.id === job.id ? { ...x, status: "uploading", progress: 0.1, error: null, retries: (x.retries || 0) } : x) }));
            
            let lastNotifiedProgress = 0;
            const { objectId, meta } = await ad.putChunked(job.localUri, job.remotePath, (p) => {
              const progress = Math.max(0.1, Math.min(0.95, p));
              set((s) => ({ jobs: s.jobs.map(x => x.id === job.id ? { ...x, progress } : x) }));
              
              // Send progress notifications at milestones
              if (progress - lastNotifiedProgress >= 0.25) {
                notificationManager.uploadProgress(filename, progress);
                lastNotifiedProgress = progress;
              }
            });
            
            set((s) => ({ jobs: s.jobs.map(x => x.id === job.id ? { ...x, status: "verifying", progress: 0.98 } : x) }));
            const ok = await ad.verify(objectId);
            if (!ok) throw new Error("VERIFY_FAIL");
            
            if (meta) useStorageIndex.getState().upsert(meta);
            useAuditLog.getState().log({ who: "me", action: "upload", provider: job.provider, objectId, size: meta?.size, checksum: meta?.checksumSha256 });
            set((s) => ({ jobs: s.jobs.map(x => x.id === job.id ? { ...x, status: "complete", progress: 1 } : x) }));
            
            // Notify upload completed
            notificationManager.uploadCompleted(filename, job.provider);
            successful++;
            
          } catch (e: any) {
            const msg = String(e?.message || e || "Upload failed");
            const currentJob = state.jobs.find(j => j.id === job.id);
            const retryCount = (currentJob?.retries || 0) + 1;
            
            // Try to schedule a retry
            const retryScheduled = smartQueueManager.scheduleRetry(job.id, retryCount, async () => {
              // Retry the job by setting it back to pending
              set((s) => ({ jobs: s.jobs.map(x => x.id === job.id ? { ...x, status: "pending", error: null, retries: retryCount } : x) }));
              // Trigger pump again for retry
              setTimeout(() => get().pump(), 1000);
            });
            
            if (retryScheduled) {
              set((s) => ({ jobs: s.jobs.map(x => x.id === job.id ? { ...x, status: "pending", error: `${msg} (retry ${retryCount} scheduled)`, retries: retryCount } : x) }));
              notificationManager.warning('Upload Failed', `${filename} will retry in a moment`);
            } else {
              set((s) => ({ jobs: s.jobs.map(x => x.id === job.id ? { ...x, status: "failed", error: msg, retries: retryCount } : x) }));
              notificationManager.uploadFailed(filename, msg);
              failed++;
            }
          } finally {
            // Mark upload as finished
            smartQueueManager.finishUpload();
          }
        }
        
        // Notify queue processing completed
        if (pendingJobs.length > 0) {
          notificationManager.queueProcessingCompleted(successful, failed);
        }
      }
    }),
    { name: "storage-queue", storage: createJSONStorage(() => AsyncStorage) }
  )
);

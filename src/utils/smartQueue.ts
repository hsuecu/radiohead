import NetInfo from '@react-native-community/netinfo';
import { notificationManager } from './notifications';

export interface NetworkInfo {
  isConnected: boolean;
  type: string;
  isWiFi: boolean;
  isCellular: boolean;
  isExpensive: boolean;
}

export interface QueueSettings {
  pauseOnCellular: boolean;
  maxConcurrentUploads: number;
  maxRetries: number;
  retryDelayMs: number;
  batchSize: number;
  prioritizeSmallFiles: boolean;
}

export const DEFAULT_QUEUE_SETTINGS: QueueSettings = {
  pauseOnCellular: false,
  maxConcurrentUploads: 2,
  maxRetries: 3,
  retryDelayMs: 5000,
  batchSize: 5,
  prioritizeSmallFiles: true,
};

class SmartQueueManager {
  private networkInfo: NetworkInfo = {
    isConnected: false,
    type: 'unknown',
    isWiFi: false,
    isCellular: false,
    isExpensive: false,
  };

  private settings: QueueSettings = DEFAULT_QUEUE_SETTINGS;
  private activeUploads = 0;
  private retryTimeouts = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.initNetworkMonitoring();
  }

  private async initNetworkMonitoring() {
    // Get initial network state
    const state = await NetInfo.fetch();
    this.updateNetworkInfo(state);

    // Subscribe to network changes
    NetInfo.addEventListener(this.updateNetworkInfo.bind(this));
  }

  private updateNetworkInfo(state: any) {
    const wasConnected = this.networkInfo.isConnected;
    
    this.networkInfo = {
      isConnected: state.isConnected ?? false,
      type: state.type || 'unknown',
      isWiFi: state.type === 'wifi',
      isCellular: state.type === 'cellular',
      isExpensive: state.isConnectionExpensive ?? false,
    };

    // Notify about network changes that affect uploads
    if (!wasConnected && this.networkInfo.isConnected) {
      notificationManager.info('Network Connected', 'Upload queue will resume');
    } else if (wasConnected && !this.networkInfo.isConnected) {
      notificationManager.warning('Network Disconnected', 'Uploads paused until connection restored');
    } else if (this.networkInfo.isCellular && this.settings.pauseOnCellular) {
      notificationManager.warning('Cellular Network', 'Uploads paused on cellular data');
    }
  }

  updateSettings(newSettings: Partial<QueueSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  getSettings(): QueueSettings {
    return { ...this.settings };
  }

  getNetworkInfo(): NetworkInfo {
    return { ...this.networkInfo };
  }

  shouldPauseUploads(): boolean {
    if (!this.networkInfo.isConnected) return true;
    if (this.networkInfo.isCellular && this.settings.pauseOnCellular) return true;
    return false;
  }

  canStartUpload(): boolean {
    if (this.shouldPauseUploads()) return false;
    return this.activeUploads < this.settings.maxConcurrentUploads;
  }

  startUpload(): boolean {
    if (!this.canStartUpload()) return false;
    this.activeUploads++;
    return true;
  }

  finishUpload() {
    this.activeUploads = Math.max(0, this.activeUploads - 1);
  }

  scheduleRetry(jobId: string, attempt: number, callback: () => void): boolean {
    if (attempt >= this.settings.maxRetries) {
      return false; // Max retries reached
    }

    // Clear any existing retry timeout
    const existingTimeout = this.retryTimeouts.get(jobId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Calculate exponential backoff delay
    const baseDelay = this.settings.retryDelayMs;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitterDelay = exponentialDelay + (Math.random() * 1000); // Add jitter

    const timeout = setTimeout(() => {
      this.retryTimeouts.delete(jobId);
      callback();
    }, jitterDelay);

    this.retryTimeouts.set(jobId, timeout);
    return true;
  }

  cancelRetry(jobId: string) {
    const timeout = this.retryTimeouts.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(jobId);
    }
  }

  optimizeJobOrder<T extends { id: string; localUri?: string; remotePath?: string }>(jobs: T[]): T[] {
    if (!this.settings.prioritizeSmallFiles) {
      return jobs;
    }

    // Sort jobs by estimated file size (smaller files first)
    return [...jobs].sort((a, b) => {
      const aPath = a.remotePath || a.localUri || '';
      const bPath = b.remotePath || b.localUri || '';
      
      // Simple heuristic: shorter paths often mean smaller files
      // In a real implementation, you'd check actual file sizes
      return aPath.length - bPath.length;
    });
  }

  getBatchedJobs<T>(jobs: T[]): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < jobs.length; i += this.settings.batchSize) {
      batches.push(jobs.slice(i, i + this.settings.batchSize));
    }
    return batches;
  }

  getUploadStrategy(): {
    shouldPause: boolean;
    canStart: boolean;
    networkType: string;
    recommendation: string;
  } {
    const shouldPause = this.shouldPauseUploads();
    const canStart = this.canStartUpload();
    
    let recommendation = '';
    if (!this.networkInfo.isConnected) {
      recommendation = 'No internet connection. Uploads will resume when connected.';
    } else if (this.networkInfo.isCellular && this.settings.pauseOnCellular) {
      recommendation = 'Uploads paused on cellular data. Connect to WiFi or change settings.';
    } else if (!canStart) {
      recommendation = `Maximum concurrent uploads (${this.settings.maxConcurrentUploads}) reached.`;
    } else {
      recommendation = 'Ready to upload.';
    }

    return {
      shouldPause,
      canStart,
      networkType: this.networkInfo.type,
      recommendation,
    };
  }

  estimateUploadTime(fileSizeBytes: number): number {
    // Simple estimation based on network type
    // In a real implementation, you'd use actual bandwidth measurements
    let speedBytesPerSecond = 1024 * 1024; // 1 MB/s default

    if (this.networkInfo.isWiFi) {
      speedBytesPerSecond = 5 * 1024 * 1024; // 5 MB/s for WiFi
    } else if (this.networkInfo.isCellular) {
      speedBytesPerSecond = 1024 * 1024; // 1 MB/s for cellular
    }

    return Math.ceil(fileSizeBytes / speedBytesPerSecond);
  }

  getQueueStats(jobs: any[]): {
    total: number;
    pending: number;
    uploading: number;
    completed: number;
    failed: number;
    estimatedTimeRemaining: number;
  } {
    const stats = {
      total: jobs.length,
      pending: 0,
      uploading: 0,
      completed: 0,
      failed: 0,
      estimatedTimeRemaining: 0,
    };

    let totalEstimatedBytes = 0;

    for (const job of jobs) {
      switch (job.status) {
        case 'pending':
          stats.pending++;
          totalEstimatedBytes += 1024 * 1024; // Assume 1MB per file
          break;
        case 'uploading':
          stats.uploading++;
          totalEstimatedBytes += (1 - (job.progress || 0)) * 1024 * 1024;
          break;
        case 'complete':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }
    }

    stats.estimatedTimeRemaining = this.estimateUploadTime(totalEstimatedBytes);
    return stats;
  }

  cleanup() {
    // Clear all retry timeouts
    for (const timeout of this.retryTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.retryTimeouts.clear();
  }
}

export const smartQueueManager = new SmartQueueManager();
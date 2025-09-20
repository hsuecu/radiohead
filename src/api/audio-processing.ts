/**
 * AWS MediaConvert Audio Processing API
 * Professional broadcast-quality audio processing with industry standards
 */

export type BroadcastStandard = 
  | "broadcast_uk_eu"    // -23 LKFS (UK/EU)
  | "broadcast_us"       // -24 LKFS (US)
  | "radio_promo"        // -16 LKFS (Radio Promo/Presenter Link)
  | "podcast_streaming"  // -14 LKFS (Podcast/Streaming)
  | "check_levels_only"; // Analyze only, no changes

export type ProcessingOptions = {
  standard: BroadcastStandard;
  cleanAndPolish: boolean; // Noise reduction + speech EQ
  customSettings?: {
    targetLufs?: number;
    truePeakLimit?: number;
    noiseReduction?: boolean;
    speechEq?: boolean;
    compressor?: boolean;
  };
};

export type ProcessingJobStatus = 
  | "uploading"
  | "queued" 
  | "processing"
  | "finalizing"
  | "completed"
  | "failed";

export type AudioAnalysisReport = {
  // Input measurements
  inputLufs: number;
  inputTruePeak: number;
  inputDynamicRange: number;
  inputDuration: number;
  
  // Output measurements (if processed)
  outputLufs?: number;
  outputTruePeak?: number;
  outputDynamicRange?: number;
  
  // Processing applied
  gainAdjustment?: number;
  limitingApplied?: boolean;
  noiseReductionApplied?: boolean;
  eqApplied?: boolean;
  compressionApplied?: boolean;
  
  // Quality metrics
  qualityScore: number; // 0-100
  broadcastCompliant: boolean;
  warnings: string[];
  recommendations: string[];
};

export type ProcessingJob = {
  jobId: string;
  status: ProcessingJobStatus;
  progress: number; // 0-100
  inputFileUrl: string;
  outputFileUrl?: string;
  analysisReport?: AudioAnalysisReport;
  error?: string;
  createdAt: number;
  updatedAt: number;
  estimatedCompletionMs?: number;
};

// Broadcast standard presets
export const BROADCAST_STANDARDS = {
  broadcast_uk_eu: {
    name: "Broadcast Standard (UK/EU)",
    description: "EBU R128 compliant for European broadcasting",
    targetLufs: -23,
    truePeakLimit: -1,
    icon: "radio" as const,
    color: "#3B82F6",
    guidance: "Required for BBC, ITV, and most European broadcasters"
  },
  broadcast_us: {
    name: "Broadcast Standard (US)",
    description: "ATSC A/85 compliant for US broadcasting",
    targetLufs: -24,
    truePeakLimit: -2,
    icon: "tv" as const,
    color: "#EF4444", 
    guidance: "Required for NBC, CBS, ABC, and US cable networks"
  },
  radio_promo: {
    name: "Radio Promo / Presenter Link",
    description: "Optimized for radio promos and presenter links",
    targetLufs: -16,
    truePeakLimit: -1,
    icon: "mic" as const,
    color: "#F59E0B",
    guidance: "Higher level for impact and presence in radio content"
  },
  podcast_streaming: {
    name: "Podcast / Streaming",
    description: "Optimized for podcast platforms and streaming",
    targetLufs: -14,
    truePeakLimit: -1,
    icon: "headset" as const,
    color: "#10B981",
    guidance: "Spotify, Apple Podcasts, and streaming platform standard"
  },
  check_levels_only: {
    name: "Check Levels Only",
    description: "Analyze audio without making changes",
    targetLufs: null,
    truePeakLimit: null,
    icon: "analytics" as const,
    color: "#8B5CF6",
    guidance: "Get detailed analysis report without processing"
  }
} as const;

/**
 * Upload audio file and get processing job
 */
export async function startAudioProcessing(
  audioUri: string,
  options: ProcessingOptions
): Promise<ProcessingJob> {
  try {
    // Step 1: Get upload URL
    const uploadResponse = await fetch("/api/audio-processing/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: `audio_${Date.now()}.wav`,
        contentType: "audio/wav"
      })
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to get upload URL");
    }

    const { uploadUrl, fileKey } = await uploadResponse.json();

    // Step 2: Upload file to S3
    const fileResponse = await fetch(audioUri);
    const fileBlob = await fileResponse.blob();

    const uploadResult = await fetch(uploadUrl, {
      method: "PUT",
      body: fileBlob,
      headers: {
        "Content-Type": "audio/wav"
      }
    });

    if (!uploadResult.ok) {
      throw new Error("Failed to upload audio file");
    }

    // Step 3: Start processing job
    const processResponse = await fetch("/api/audio-processing/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputFileKey: fileKey,
        options
      })
    });

    if (!processResponse.ok) {
      throw new Error("Failed to start processing job");
    }

    const job: ProcessingJob = await processResponse.json();
    return job;

  } catch (error) {
    console.error("Audio processing error:", error);
    throw new Error(`Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Check processing job status
 */
export async function getProcessingJobStatus(jobId: string): Promise<ProcessingJob> {
  try {
    const response = await fetch(`/api/audio-processing/job/${jobId}`);
    
    if (!response.ok) {
      throw new Error("Failed to get job status");
    }

    const job: ProcessingJob = await response.json();
    return job;

  } catch (error) {
    console.error("Job status error:", error);
    throw new Error(`Status check failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Poll job status until completion
 */
export async function pollProcessingJob(
  jobId: string,
  onProgress?: (job: ProcessingJob) => void,
  pollIntervalMs: number = 2000
): Promise<ProcessingJob> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const job = await getProcessingJobStatus(jobId);
        
        onProgress?.(job);

        if (job.status === "completed") {
          resolve(job);
        } else if (job.status === "failed") {
          reject(new Error(job.error || "Processing failed"));
        } else {
          // Continue polling
          setTimeout(poll, pollIntervalMs);
        }
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}

/**
 * Download processed audio file
 */
export async function downloadProcessedAudio(outputUrl: string): Promise<string> {
  try {
    // In a real implementation, this would download and save to local storage
    // For now, return the URL directly
    return outputUrl;
  } catch (error) {
    console.error("Download error:", error);
    throw new Error(`Download failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Mock implementation for development
 * Remove this when AWS MediaConvert backend is ready
 */
export async function mockAudioProcessing(
  audioUri: string,
  options: ProcessingOptions
): Promise<ProcessingJob> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  // Simulate processing time based on standard
  const processingTimeMs = options.standard === "check_levels_only" ? 3000 : 8000;
  
  const job: ProcessingJob = {
    jobId,
    status: "uploading",
    progress: 0,
    inputFileUrl: audioUri,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    estimatedCompletionMs: processingTimeMs
  };

  return job;
}

/**
 * Mock job status polling
 */
export async function mockPollProcessingJob(
  jobId: string,
  onProgress?: (job: ProcessingJob) => void
): Promise<ProcessingJob> {
  const stages: { status: ProcessingJobStatus; progress: number; duration: number }[] = [
    { status: "uploading", progress: 20, duration: 1000 },
    { status: "queued", progress: 30, duration: 500 },
    { status: "processing", progress: 80, duration: 4000 },
    { status: "finalizing", progress: 95, duration: 1000 },
    { status: "completed", progress: 100, duration: 500 }
  ];

  let currentStage = 0;

  return new Promise((resolve) => {
    const updateProgress = () => {
      if (currentStage >= stages.length) {
        // Complete with mock analysis report
        const completedJob: ProcessingJob = {
          jobId,
          status: "completed",
          progress: 100,
          inputFileUrl: "mock://input.wav",
          outputFileUrl: "mock://processed_output.wav",
          analysisReport: {
            inputLufs: -18.5,
            inputTruePeak: -0.2,
            inputDynamicRange: 12.3,
            inputDuration: 45.2,
            outputLufs: -23.0,
            outputTruePeak: -1.0,
            outputDynamicRange: 11.8,
            gainAdjustment: -4.5,
            limitingApplied: true,
            noiseReductionApplied: true,
            eqApplied: false,
            compressionApplied: false,
            qualityScore: 92,
            broadcastCompliant: true,
            warnings: [],
            recommendations: [
              "Audio successfully processed to broadcast standards",
              "Consider using a pop filter for future recordings"
            ]
          },
          createdAt: Date.now() - 8000,
          updatedAt: Date.now()
        };
        
        onProgress?.(completedJob);
        resolve(completedJob);
        return;
      }

      const stage = stages[currentStage];
      const job: ProcessingJob = {
        jobId,
        status: stage.status,
        progress: stage.progress,
        inputFileUrl: "mock://input.wav",
        createdAt: Date.now() - 8000,
        updatedAt: Date.now()
      };

      onProgress?.(job);

      setTimeout(() => {
        currentStage++;
        updateProgress();
      }, stage.duration);
    };

    updateProgress();
  });
}
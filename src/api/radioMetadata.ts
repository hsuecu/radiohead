/**
 * Radio Metadata Service
 * Handles ICY metadata parsing and stream information extraction
 */

export interface StreamMetadata {
  title?: string;
  artist?: string;
  album?: string;
  station?: string;
  genre?: string;
  bitrate?: number;
  nowPlaying?: string;
  timestamp?: number;
}

export interface StreamInfo {
  name?: string;
  description?: string;
  genre?: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  format?: string;
  url: string;
}

class RadioMetadataService {
  private metadataCache = new Map<string, StreamMetadata>();
  private streamInfoCache = new Map<string, StreamInfo>();
  private pollingIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * Extract metadata from ICY headers (simulated for now)
   * In a real implementation, this would parse actual ICY metadata
   */
  async fetchStreamMetadata(streamUrl: string): Promise<StreamMetadata | null> {
    try {
      // Check cache first
      const cached = this.metadataCache.get(streamUrl);
      if (cached && Date.now() - (cached.timestamp || 0) < 30000) {
        return cached;
      }

      // Simulate metadata extraction
      // In a real implementation, this would:
      // 1. Connect to the stream with ICY metadata enabled
      // 2. Parse the ICY metadata blocks
      // 3. Extract title, artist, and other information
      
      const metadata = await this.simulateMetadataFetch(streamUrl);
      
      if (metadata) {
        metadata.timestamp = Date.now();
        this.metadataCache.set(streamUrl, metadata);
      }

      return metadata;
    } catch (error) {
      console.error("Failed to fetch stream metadata:", error);
      return null;
    }
  }

  /**
   * Get stream information (format, bitrate, etc.)
   */
  async fetchStreamInfo(streamUrl: string): Promise<StreamInfo | null> {
    try {
      // Check cache first
      const cached = this.streamInfoCache.get(streamUrl);
      if (cached) {
        return cached;
      }

      // Fetch stream headers to get format information
      const response = await fetch(streamUrl, {
        method: "HEAD",
        headers: {
          "Icy-MetaData": "1", // Request ICY metadata
          "User-Agent": "RadioApp/1.0"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const streamInfo: StreamInfo = {
        url: streamUrl,
        name: response.headers.get("icy-name") || undefined,
        description: response.headers.get("icy-description") || undefined,
        genre: response.headers.get("icy-genre") || undefined,
        bitrate: this.parseNumber(response.headers.get("icy-br")),
        format: response.headers.get("content-type") || undefined
      };

      // Parse additional audio format information
      const contentType = response.headers.get("content-type");
      if (contentType) {
        streamInfo.format = this.parseAudioFormat(contentType);
      }

      this.streamInfoCache.set(streamUrl, streamInfo);
      return streamInfo;

    } catch (error) {
      console.error("Failed to fetch stream info:", error);
      return null;
    }
  }

  /**
   * Start polling for metadata updates
   */
  startMetadataPolling(streamUrl: string, callback: (metadata: StreamMetadata) => void, intervalMs = 10000): void {
    // Stop existing polling for this URL
    this.stopMetadataPolling(streamUrl);

    const poll = async () => {
      const metadata = await this.fetchStreamMetadata(streamUrl);
      if (metadata) {
        callback(metadata);
      }
    };

    // Initial fetch
    poll();

    // Set up interval
    const interval = setInterval(poll, intervalMs);
    this.pollingIntervals.set(streamUrl, interval);
  }

  /**
   * Stop polling for metadata updates
   */
  stopMetadataPolling(streamUrl: string): void {
    const interval = this.pollingIntervals.get(streamUrl);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(streamUrl);
    }
  }

  /**
   * Clear all caches and stop all polling
   */
  cleanup(): void {
    // Stop all polling
    for (const [url] of this.pollingIntervals) {
      this.stopMetadataPolling(url);
    }

    // Clear caches
    this.metadataCache.clear();
    this.streamInfoCache.clear();
  }

  /**
   * Validate stream URL format
   */
  validateStreamUrl(url: string): { valid: boolean; error?: string } {
    try {
      const parsedUrl = new URL(url);
      
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return { valid: false, error: "Only HTTP and HTTPS URLs are supported" };
      }

      // Check for common streaming formats
      const path = parsedUrl.pathname.toLowerCase();
      const validExtensions = [".mp3", ".aac", ".ogg", ".m3u", ".m3u8", ".pls"];
      const hasValidExtension = validExtensions.some(ext => path.endsWith(ext));
      
      if (!hasValidExtension && !path.includes("stream")) {
        return { 
          valid: true, 
          error: "URL may not be a valid audio stream (no recognized format or 'stream' in path)" 
        };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: "Invalid URL format" };
    }
  }

  /**
   * Get cached metadata without fetching
   */
  getCachedMetadata(streamUrl: string): StreamMetadata | null {
    return this.metadataCache.get(streamUrl) || null;
  }

  /**
   * Get cached stream info without fetching
   */
  getCachedStreamInfo(streamUrl: string): StreamInfo | null {
    return this.streamInfoCache.get(streamUrl) || null;
  }

  // Private helper methods

  private async simulateMetadataFetch(_streamUrl: string): Promise<StreamMetadata | null> {
    // Simulate different types of streams with mock metadata
    const mockMetadata: StreamMetadata[] = [
      {
        title: "Summer Breeze",
        artist: "The Jazz Collective",
        station: "Jazz FM",
        genre: "Jazz",
        nowPlaying: "The Jazz Collective - Summer Breeze"
      },
      {
        title: "Morning News Update",
        station: "News Radio",
        genre: "News/Talk",
        nowPlaying: "Morning News Update"
      },
      {
        title: "Classic Rock Hits",
        artist: "Various Artists",
        station: "Rock 101",
        genre: "Rock",
        nowPlaying: "Various Artists - Classic Rock Hits"
      },
      {
        title: "Electronic Vibes",
        artist: "DJ MixMaster",
        station: "Electronic FM",
        genre: "Electronic",
        nowPlaying: "DJ MixMaster - Electronic Vibes"
      }
    ];

    // Return random metadata to simulate changing content
    const randomIndex = Math.floor(Math.random() * mockMetadata.length);
    return mockMetadata[randomIndex];
  }

  private parseNumber(value: string | null): number | undefined {
    if (!value) return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  }

  private parseAudioFormat(contentType: string): string {
    const formatMap: Record<string, string> = {
      "audio/mpeg": "MP3",
      "audio/mp3": "MP3",
      "audio/aac": "AAC",
      "audio/aacp": "AAC+",
      "audio/ogg": "OGG",
      "application/ogg": "OGG",
      "audio/x-scpls": "PLS Playlist",
      "application/vnd.apple.mpegurl": "HLS",
      "application/x-mpegurl": "M3U Playlist"
    };

    return formatMap[contentType.toLowerCase()] || contentType;
  }
}

// Singleton instance
export const radioMetadataService = new RadioMetadataService();

// Utility functions for components
export async function getStreamMetadata(streamUrl: string): Promise<StreamMetadata | null> {
  return radioMetadataService.fetchStreamMetadata(streamUrl);
}

export async function getStreamInfo(streamUrl: string): Promise<StreamInfo | null> {
  return radioMetadataService.fetchStreamInfo(streamUrl);
}

export function validateStreamUrl(url: string): { valid: boolean; error?: string } {
  return radioMetadataService.validateStreamUrl(url);
}

export function startMetadataPolling(
  streamUrl: string, 
  callback: (metadata: StreamMetadata) => void, 
  intervalMs?: number
): void {
  radioMetadataService.startMetadataPolling(streamUrl, callback, intervalMs);
}

export function stopMetadataPolling(streamUrl: string): void {
  radioMetadataService.stopMetadataPolling(streamUrl);
}
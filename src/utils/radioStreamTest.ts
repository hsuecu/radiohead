import { useRadioStore } from "../state/radioStore";
import { radioAudioManager } from "./radioAudioManager";

/**
 * Test utility for validating radio streaming functionality
 */
export class RadioStreamTest {
  
  /**
   * Test stream URL connectivity
   */
  static async testStreamUrl(url: string): Promise<{ success: boolean; message: string; contentType?: string }> {
    try {
      // Validate URL format
      const urlObj = new URL(url);
      if (!["http:", "https:"].includes(urlObj.protocol)) {
        return { success: false, message: "Only HTTP and HTTPS URLs are supported" };
      }

      // Test connection with HEAD request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, { 
        method: "HEAD",
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, message: `Stream not accessible (HTTP ${response.status})` };
      }

      const contentType = response.headers.get("content-type");
      
      // Check if it's likely an audio stream
      const isAudioStream = contentType && (
        contentType.includes("audio") || 
        contentType.includes("application/ogg") ||
        contentType.includes("application/octet-stream")
      );

      if (isAudioStream) {
        return { 
          success: true, 
          message: "Stream URL is valid and accessible", 
          contentType: contentType || undefined 
        };
      } else {
        return { 
          success: true, 
          message: "URL accessible but may not be an audio stream", 
          contentType: contentType || undefined 
        };
      }
    } catch (error: any) {
      return { 
        success: false, 
        message: `Connection failed: ${error.message}` 
      };
    }
  }

  /**
   * Test complete radio streaming workflow
   */
  static async testStreamingWorkflow(stationId: string, streamUrl: string): Promise<{ success: boolean; steps: Array<{ step: string; success: boolean; message: string }> }> {
    const steps: Array<{ step: string; success: boolean; message: string }> = [];
    let overallSuccess = true;

    try {
      // Step 1: Test URL connectivity
      steps.push({ step: "URL Connectivity", success: false, message: "Testing..." });
      const urlTest = await this.testStreamUrl(streamUrl);
      steps[0] = { step: "URL Connectivity", success: urlTest.success, message: urlTest.message };
      if (!urlTest.success) overallSuccess = false;

      // Step 2: Configure stream in store
      steps.push({ step: "Store Configuration", success: false, message: "Configuring..." });
      try {
        useRadioStore.getState().setStreamConfig(stationId, {
          url: streamUrl,
          name: "Test Stream",
          quality: "high"
        });
        steps[1] = { step: "Store Configuration", success: true, message: "Stream configured in store" };
      } catch (error: any) {
        steps[1] = { step: "Store Configuration", success: false, message: `Configuration failed: ${error.message}` };
        overallSuccess = false;
      }

      // Step 3: Initialize audio manager
      steps.push({ step: "Audio Manager Init", success: false, message: "Initializing..." });
      try {
        await radioAudioManager.initialize();
        steps[2] = { step: "Audio Manager Init", success: true, message: "Audio manager initialized" };
      } catch (error: any) {
        steps[2] = { step: "Audio Manager Init", success: false, message: `Initialization failed: ${error.message}` };
        overallSuccess = false;
      }

      // Step 4: Load stream (but don't play)
      if (overallSuccess) {
        steps.push({ step: "Stream Loading", success: false, message: "Loading stream..." });
        try {
          const config = useRadioStore.getState().streamsByStation[stationId];
          if (config) {
            await radioAudioManager.loadStream(config);
            steps[3] = { step: "Stream Loading", success: true, message: "Stream loaded successfully" };
          } else {
            steps[3] = { step: "Stream Loading", success: false, message: "Stream configuration not found" };
            overallSuccess = false;
          }
        } catch (error: any) {
          steps[3] = { step: "Stream Loading", success: false, message: `Loading failed: ${error.message}` };
          overallSuccess = false;
        }
      }

      // Step 5: Cleanup
      steps.push({ step: "Cleanup", success: false, message: "Cleaning up..." });
      try {
        await radioAudioManager.stop();
        steps[steps.length - 1] = { step: "Cleanup", success: true, message: "Cleanup completed" };
      } catch (error: any) {
        steps[steps.length - 1] = { step: "Cleanup", success: false, message: `Cleanup failed: ${error.message}` };
      }

    } catch (error: any) {
      steps.push({ step: "Unexpected Error", success: false, message: error.message });
      overallSuccess = false;
    }

    return { success: overallSuccess, steps };
  }

  /**
   * Validate radio store state
   */
  static validateStoreState(): { valid: boolean; issues: string[] } {
    const state = useRadioStore.getState();
    const issues: string[] = [];

    // Check if store is properly initialized
    if (!state) {
      issues.push("Radio store is not initialized");
      return { valid: false, issues };
    }

    // Check volume range
    if (state.volume < 0 || state.volume > 1) {
      issues.push(`Volume out of range: ${state.volume} (should be 0-1)`);
    }

    // Check buffer health range
    if (state.bufferHealth < 0 || state.bufferHealth > 100) {
      issues.push(`Buffer health out of range: ${state.bufferHealth} (should be 0-100)`);
    }

    // Check if current station has valid config when playing
    if (state.currentStationId && state.playbackState !== "stopped") {
      const config = state.streamsByStation[state.currentStationId];
      if (!config) {
        issues.push(`No stream configuration found for current station: ${state.currentStationId}`);
      } else if (!config.url) {
        issues.push(`Stream configuration missing URL for station: ${state.currentStationId}`);
      }
    }

    return { valid: issues.length === 0, issues };
  }
}

/**
 * Quick test function for development
 */
export async function quickRadioTest(streamUrl: string = "https://stream.example.com/radio.mp3") {
  console.log("🎵 Starting Radio Stream Test...");
  
  // Test URL
  console.log("📡 Testing stream URL...");
  const urlTest = await RadioStreamTest.testStreamUrl(streamUrl);
  console.log(`   ${urlTest.success ? "✅" : "❌"} ${urlTest.message}`);
  
  // Validate store
  console.log("🏪 Validating store state...");
  const storeValidation = RadioStreamTest.validateStoreState();
  console.log(`   ${storeValidation.valid ? "✅" : "❌"} Store validation ${storeValidation.valid ? "passed" : "failed"}`);
  if (!storeValidation.valid) {
    storeValidation.issues.forEach(issue => console.log(`      - ${issue}`));
  }
  
  // Full workflow test
  console.log("🔄 Testing complete workflow...");
  const workflowTest = await RadioStreamTest.testStreamingWorkflow("test-station", streamUrl);
  console.log(`   ${workflowTest.success ? "✅" : "❌"} Workflow test ${workflowTest.success ? "passed" : "failed"}`);
  workflowTest.steps.forEach(step => {
    console.log(`      ${step.success ? "✅" : "❌"} ${step.step}: ${step.message}`);
  });
  
  console.log("🎵 Radio Stream Test Complete!");
  return {
    urlTest,
    storeValidation,
    workflowTest
  };
}
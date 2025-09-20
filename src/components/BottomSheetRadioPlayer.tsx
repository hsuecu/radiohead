import React, { useMemo, useRef, useState, useEffect } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import Animated, { useAnimatedStyle, useSharedValue, interpolate, Extrapolation } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useRadioStore, useRadioPlaybackState, useRadioMetadata } from "../state/radioStore";
import { useStationStore } from "../state/stationStore";
import { useRadioAudioManager } from "../utils/radioAudioManager";
import { Visualizer } from "./Visualizer";
import { useRadioUiStore } from "../state/radioUiStore";

import { streamRecorder } from "../utils/streamRecorder";
import { ErrorBoundary } from "./ErrorBoundary";
import { getWinampTheme, createChromeButtonStyle, createLedTextStyle, WinampDesign, type WinampTheme } from "../utils/winampThemes";

const SCREEN_W = Dimensions.get("window").width;

function RecordingPresetButton({ duration }: { duration: number }) {
  const [isActive, setIsActive] = useState(false);
  const colors = getWinampTheme("classic");
  
  const handlePress = async () => {
    if (isActive) return;
    
    setIsActive(true);
    // Auto-stop after duration
    setTimeout(async () => {
      const result = await streamRecorder.stopAndSaveToLibrary();
      setIsActive(false);
      console.log(`${duration}min recording completed:`, result);
    }, duration * 60 * 1000);
  };
  
  return (
    <Pressable 
      onPress={handlePress}
      disabled={isActive}
      style={{
        ...createChromeButtonStyle(isActive, "classic"),
        backgroundColor: isActive ? colors.ledRed : colors.buttonNormal,
        paddingHorizontal: WinampDesign.spacing.md,
        paddingVertical: WinampDesign.spacing.sm
      }}
    >
      <Text style={{
        ...WinampDesign.fonts.display,
        color: isActive ? colors.darkBg : colors.textPrimary,
        fontSize: 10,
        fontWeight: "bold",
        textTransform: "uppercase"
      }}>
        {duration}MIN {isActive ? "●" : ""}
      </Text>
    </Pressable>
  );
}

function RecordControls({ url }: { url?: string }) {
  const [recordingStatus, setRecordingStatus] = useState(streamRecorder.getStatus());
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [mode, setMode] = useState<"auto" | "stream" | "mic">("auto");

  useEffect(() => {
    const interval = setInterval(() => {
      setRecordingStatus(streamRecorder.getStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const start = async () => {
    if (!url) return;
    setLastResult(null);
    const success = await streamRecorder.start(url, mode);
    if (!success) {
      setLastResult("Failed to start recording");
    }
  };

  const stop = async () => {
    const result = await streamRecorder.stopAndSaveToLibrary();
    if (result.success) {
      const albumText = result.savedToAlbum ? " to Radio Captures album" : " to Photos";
      setLastResult(`✓ Saved${albumText}`);
    } else {
      setLastResult(`✗ ${result.error}`);
    }
  };

  const cancel = async () => {
    await streamRecorder.cancel();
    setLastResult("Recording cancelled");
  };

  const isRecording = recordingStatus.status === "recording";
  const isSaving = recordingStatus.status === "saving";
  const hasError = recordingStatus.status === "error" || recordingStatus.status === "permission_denied";

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const colors = getWinampTheme("classic");

  return (
    <View style={{ marginTop: WinampDesign.spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <View style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            marginRight: WinampDesign.spacing.sm,
            backgroundColor: isRecording ? colors.ledRed : 
                           isSaving ? colors.ledOrange :
                           hasError ? colors.ledRed : colors.ledOff,
            shadowColor: isRecording ? colors.ledRed : colors.ledOrange,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 2,
            shadowOpacity: isRecording || isSaving ? 0.8 : 0
          }} />
          <View style={{ flex: 1 }}>
            <Text style={{
              ...createLedTextStyle("classic"),
              fontSize: 10
            }}>
              {isRecording ? `REC ${formatDuration(recordingStatus.durationMs)}` :
               isSaving ? "SAVING..." :
               hasError ? "ERROR" :
               "READY"}
            </Text>
            {isRecording && recordingStatus.sizeMB > 0 && (
              <Text style={{
                ...WinampDesign.fonts.display,
                color: colors.textSecondary,
                fontSize: 9
              }}>
                {recordingStatus.sizeMB.toFixed(1)} MB
              </Text>
            )}
            {/* Mode and method display */}
            <Text style={{
              ...WinampDesign.fonts.display,
              color: colors.textDim,
              fontSize: 9
            }}>
              Mode: {mode.toUpperCase()} - Method: {(recordingStatus as any).method === "audio" ? "MIC" : "STREAM"}
            </Text>
            {mode === "auto" && isRecording && (recordingStatus as any).method === "audio" && (
              <Text style={{
                ...createLedTextStyle("classic", true),
                fontSize: 9,
                marginTop: WinampDesign.spacing.xs
              }}>
                Auto fallback to Mic based on stream
              </Text>
            )}
            {recordingStatus.status === "permission_denied" && (
              <Text style={{
                ...createLedTextStyle("classic", true),
                color: colors.ledRed,
                fontSize: 9,
                marginTop: WinampDesign.spacing.xs
              }}>
                Microphone permission denied. Enable in Settings to record with Mic.
              </Text>
            )}
          </View>
        </View>
        
        {/* Mode selector */}
        {!isRecording && (
          <View style={{ flexDirection: "row", marginTop: WinampDesign.spacing.sm }}>
            {(["auto","stream","mic"] as const).map(m => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={{
                  ...createChromeButtonStyle(mode === m, "classic"),
                  marginRight: WinampDesign.spacing.sm,
                  paddingHorizontal: WinampDesign.spacing.md,
                  paddingVertical: WinampDesign.spacing.xs,
                  backgroundColor: mode === m ? colors.ledGreen : undefined
                }}
              >
                <Text style={{
                  ...WinampDesign.fonts.display,
                  color: mode === m ? colors.darkBg : colors.textPrimary,
                  fontSize: 10,
                  textTransform: "uppercase"
                }}>{m}</Text>
              </Pressable>
            ))}
          </View>
        )}
        
        <View style={{ flexDirection: "row", marginTop: WinampDesign.spacing.sm }}>
          {isRecording ? (
            <>
              <Pressable 
                onPress={cancel} 
                style={{
                  ...createChromeButtonStyle(false, "classic"),
                  paddingHorizontal: WinampDesign.spacing.md,
                  paddingVertical: WinampDesign.spacing.sm,
                  marginRight: WinampDesign.spacing.sm
                }}
              >
                <Text style={{
                  ...WinampDesign.fonts.display,
                  color: colors.textPrimary,
                  fontSize: 10,
                  textTransform: "uppercase"
                }}>CANCEL</Text>
              </Pressable>
              <Pressable 
                onPress={stop} 
                style={{
                  ...createChromeButtonStyle(false, "classic"),
                  backgroundColor: colors.ledRed,
                  paddingHorizontal: WinampDesign.spacing.md,
                  paddingVertical: WinampDesign.spacing.sm
                }}
              >
                <Text style={{
                  ...WinampDesign.fonts.display,
                  color: colors.darkBg,
                  fontSize: 10,
                  fontWeight: "bold",
                  textTransform: "uppercase"
                }}>STOP</Text>
              </Pressable>
            </>
          ) : (
            <Pressable 
              onPress={start} 
              disabled={!url || isSaving} 
              style={{
                ...createChromeButtonStyle(false, "classic"),
                backgroundColor: (!url || isSaving) ? colors.buttonPressed : colors.ledGreen,
                paddingHorizontal: WinampDesign.spacing.md,
                paddingVertical: WinampDesign.spacing.sm
              }}
            >
              <Text style={{
                ...WinampDesign.fonts.display,
                color: (!url || isSaving) ? colors.textDim : colors.darkBg,
                fontSize: 10,
                fontWeight: "bold",
                textTransform: "uppercase"
              }}>
                {isSaving ? "SAVING..." : "RECORD"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
      
      {lastResult && (
        <Text style={{
          ...createLedTextStyle("classic"),
          fontSize: 9,
          marginTop: WinampDesign.spacing.xs,
          color: lastResult.startsWith("✓") ? colors.ledGreen : colors.ledRed
        }}>
          {lastResult}
        </Text>
      )}
      
      {hasError && recordingStatus.error && (
        <Text style={{
          ...createLedTextStyle("classic"),
          fontSize: 9,
          marginTop: WinampDesign.spacing.xs,
          color: colors.ledRed
        }}>
          {recordingStatus.error}
        </Text>
      )}
    </View>
  );
}

function FavoritesRow() {
  const favorites = useRadioStore((s) => s.favorites);
  const setCurrentFromFavorite = useRadioStore((s) => s.setCurrentFromFavorite);
  const addFavorite = useRadioStore((s) => s.addFavorite);
  const stream = useRadioStore((s) => s.getCurrentStreamConfig());
  const colors = getWinampTheme("classic");

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {favorites.map((f, idx) => (
        <Pressable 
          key={f.url} 
          onPress={() => setCurrentFromFavorite(idx)} 
          style={{
            ...createChromeButtonStyle(false, "classic"),
            marginRight: WinampDesign.spacing.sm,
            marginBottom: WinampDesign.spacing.sm,
            paddingHorizontal: WinampDesign.spacing.md,
            paddingVertical: WinampDesign.spacing.xs
          }}
        >
          <Text style={{
            ...WinampDesign.fonts.display,
            color: colors.textPrimary,
            fontSize: 10,
            textTransform: "uppercase"
          }} numberOfLines={1}>
            {f.name || new URL(f.url).hostname}
          </Text>
        </Pressable>
      ))}
      {favorites.length < 5 && stream?.url && (
        <Pressable 
          onPress={() => addFavorite(stream)} 
          style={{
            ...createChromeButtonStyle(false, "classic"),
            backgroundColor: colors.ledGreen,
            marginRight: WinampDesign.spacing.sm,
            marginBottom: WinampDesign.spacing.sm,
            paddingHorizontal: WinampDesign.spacing.md,
            paddingVertical: WinampDesign.spacing.xs
          }}
        >
          <Text style={{
            ...WinampDesign.fonts.display,
            color: colors.darkBg,
            fontSize: 10,
            fontWeight: "bold",
            textTransform: "uppercase"
          }}>+ ADD</Text>
        </Pressable>
      )}
    </View>
  );
}

export function BottomSheetRadioPlayer() {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [56, Math.min(600, Math.round(Dimensions.get("window").height * 0.65))], []);
  const [visualTheme, setVisualTheme] = useState<"spectrum" | "waveform" | "particles" | "rings" | "pulse">("spectrum");
  const [winampTheme] = useState<WinampTheme>("classic");
  const colors = getWinampTheme(winampTheme);

  const playbackState = useRadioPlaybackState();
  const metadata = useRadioMetadata();
  const volume = useRadioStore((s) => s.volume);
  const muted = useRadioStore((s) => s.muted);
  const connectionStatus = useRadioStore((s) => s.connectionStatus);
  const bufferHealth = useRadioStore((s) => s.bufferHealth);
  const currentStationId = useRadioStore((s) => s.currentStationId);
  const streamsByStation = useRadioStore((s) => s.streamsByStation);

  const stations = useStationStore((s) => s.stations);
  const currentStation = currentStationId ? stations.find((s) => s.id === currentStationId) : stations[0];
  const streamConfig = currentStationId ? streamsByStation[currentStationId] : undefined;

  const { playStream, pauseStream, stopStream, setStreamVolume, toggleStreamMute } = useRadioAudioManager();

  const handlePlayPause = async () => {
    if (playbackState === "playing") await pauseStream();
    else if (playbackState === "paused") await playStream();
    else if (currentStationId) await playStream(currentStationId);
  };

  const progress = useSharedValue(0);
  const onAnimate = (_: number, to: number) => {
    "worklet";
    progress.value = to;
  };

  // Floating opener button visibility (only when collapsed)
  const fabStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.2], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 0.2], [0, 20], Extrapolation.CLAMP) }]
  }));

  const setOpenState = useRadioUiStore((s) => s.setOpenState);
  const desiredOpen = useRadioUiStore((s) => s.desiredOpen);
  const lastCmdAt = useRadioUiStore((s) => s.lastCmdAt);

  React.useEffect(() => {
    if (desiredOpen == null) return;
    const idx = desiredOpen ? 1 : 0;
    try { sheetRef.current?.snapToIndex(idx); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCmdAt]);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0.9], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1], Extrapolation.CLAMP) }],
  }));

  const bigArtStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.85, 1], Extrapolation.CLAMP) }],
  }));

  const mini = (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: WinampDesign.spacing.lg,
      height: 56,
      backgroundColor: colors.mainBg,
      ...WinampDesign.borders.chrome
    }}>
      {/* Chrome grip indicator */}
      <View style={{
        position: "absolute",
        top: WinampDesign.spacing.xs,
        left: "50%",
        marginLeft: -16,
        width: 32,
        height: 3,
        backgroundColor: colors.chromeDark,
        borderRadius: 1,
        ...WinampDesign.borders.chrome
      }} />
      
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: WinampDesign.spacing.md, marginTop: WinampDesign.spacing.sm }}>
        {/* LED Status Indicator */}
        <View style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          marginRight: WinampDesign.spacing.sm,
          backgroundColor: connectionStatus === "connected" ? colors.ledGreen : 
                          connectionStatus === "connecting" ? colors.ledOrange : 
                          connectionStatus === "error" ? colors.ledRed : colors.ledOff,
          shadowColor: connectionStatus === "connected" ? colors.ledGreen : colors.ledOrange,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 3,
          shadowOpacity: 0.8
        }} />
        <Text style={{
          ...createLedTextStyle(winampTheme),
          fontSize: 12,
          flex: 1
        }} numberOfLines={1}>
          {metadata?.nowPlaying || currentStation?.name || streamConfig?.name || "RADIO"}
        </Text>
      </View>
      
      <Pressable 
        onPress={handlePlayPause} 
        disabled={playbackState === "loading" || connectionStatus === "connecting"}
        style={{
          ...createChromeButtonStyle(false, winampTheme),
          width: 32,
          height: 24,
          marginTop: WinampDesign.spacing.sm
        }}
      >
        <Ionicons 
          name={playbackState === "playing" ? "pause" : playbackState === "loading" ? "hourglass-outline" : "play"} 
          size={16} 
          color={colors.textPrimary} 
        />
      </Pressable>
    </View>
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      backdropComponent={(p) => <BottomSheetBackdrop {...p} appearsOnIndex={1} disappearsOnIndex={0} opacity={0.1} />}
      enablePanDownToClose={false}
      handleComponent={() => <View />}
      animatedPosition={progress}
      onAnimate={onAnimate}
      backgroundStyle={{ backgroundColor: colors.darkBg }}
      handleStyle={{ backgroundColor: colors.darkBg }}
      onChange={(index) => { try { setOpenState(index > 0); } catch {} }}
    >
      {/* Mini Header */}
      <Animated.View style={headerStyle}>{mini}</Animated.View>

      {/* Floating opener button - Winamp style */}
      <Animated.View style={[{ 
        position: "absolute", 
        right: 16, 
        bottom: 100, // Increased from 90 to ensure visibility above tab bar
        zIndex: 1000, // Increased z-index to ensure it appears above other elements
        elevation: 10 // For Android
      }, fabStyle]}>
        <Pressable 
          onPress={() => sheetRef.current?.snapToIndex(1)} 
          style={{
            ...createChromeButtonStyle(false, winampTheme),
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: WinampDesign.spacing.md,
            paddingVertical: WinampDesign.spacing.sm,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5
          }}
        >
          <View style={{
            width: 6,
            height: 6,
            backgroundColor: colors.ledRed,
            borderRadius: 3,
            marginRight: WinampDesign.spacing.sm,
            shadowColor: colors.ledRed,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 2,
            shadowOpacity: 0.8
          }} />
          <Text style={{
            ...WinampDesign.fonts.display,
            color: colors.textPrimary,
            fontSize: 10,
            textTransform: "uppercase"
          }}>RADIO</Text>
        </Pressable>
      </Animated.View>

      {/* Expanded - Winamp Main Window */}
      <BottomSheetView style={{ 
        paddingHorizontal: WinampDesign.spacing.lg, 
        paddingBottom: WinampDesign.spacing.xl * 2,
        backgroundColor: colors.mainBg
      }}>
        {/* Spectrum Analyzer Window */}
        <Animated.View style={[{
          marginTop: WinampDesign.spacing.md,
          borderRadius: 4,
          overflow: "hidden",
          backgroundColor: colors.darkBg,
          ...WinampDesign.borders.chrome,
          padding: WinampDesign.spacing.xs
        }, bigArtStyle]}>
          <View style={{ width: SCREEN_W - 32, height: 200, alignItems: "center", justifyContent: "center" }}>
            <ErrorBoundary>
              <Visualizer 
                width={SCREEN_W - 40} 
                height={192} 
                theme={visualTheme} 
                intensity={0.85} 
                isActive={playbackState === "playing"}
                onThemeChange={setVisualTheme}
                winampTheme={winampTheme}
              />
            </ErrorBoundary>
          </View>
        </Animated.View>

        {/* LED Display Panel */}
        <View style={{
          marginTop: WinampDesign.spacing.md,
          backgroundColor: colors.darkBg,
          padding: WinampDesign.spacing.md,
          borderRadius: 4,
          ...WinampDesign.borders.chrome
        }}>
          <Text style={{
            ...createLedTextStyle(winampTheme),
            fontSize: 14,
            textAlign: "center"
          }} numberOfLines={1}>
            {metadata?.nowPlaying || streamConfig?.name || currentStation?.name || "LIVE STREAM"}
          </Text>
          <Text style={{
            ...WinampDesign.fonts.display,
            color: colors.textSecondary,
            fontSize: 10,
            textAlign: "center",
            marginTop: WinampDesign.spacing.xs
          }} numberOfLines={1}>
            {streamConfig?.url || ""}
          </Text>
          {connectionStatus === "connecting" && (
            <Text style={{
              ...createLedTextStyle(winampTheme, true),
              fontSize: 10,
              textAlign: "center",
              marginTop: WinampDesign.spacing.xs
            }}>SWITCHING...</Text>
          )}
        </View>

        {/* Transport Controls - Classic Winamp Style */}
        <View style={{
          marginTop: WinampDesign.spacing.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.chromeBg,
          padding: WinampDesign.spacing.md,
          borderRadius: 4,
          ...WinampDesign.borders.chrome
        }}>
          <Pressable 
            onPress={() => setStreamVolume(Math.max(0, volume - 0.1))} 
            style={createChromeButtonStyle(false, winampTheme)}
          >
            <Ionicons name="remove" size={16} color={colors.textPrimary} />
          </Pressable>
          
          <Pressable 
            onPress={toggleStreamMute} 
            style={createChromeButtonStyle(muted, winampTheme)}
          >
            <Ionicons 
              name={muted ? "volume-mute" : "volume-high"} 
              size={16} 
              color={muted ? colors.ledRed : colors.textPrimary} 
            />
          </Pressable>
          
          <Pressable 
            onPress={handlePlayPause} 
            disabled={playbackState === "loading" || connectionStatus === "connecting"} 
            style={{
              ...createChromeButtonStyle(playbackState === "playing", winampTheme),
              paddingHorizontal: WinampDesign.spacing.lg,
              minWidth: 80
            }}
          > 
            <Text style={{
              ...WinampDesign.fonts.display,
              color: colors.textPrimary,
              fontSize: 12,
              fontWeight: "bold",
              textTransform: "uppercase"
            }}>
              {playbackState === "playing" ? "PAUSE" : "PLAY"}
            </Text>
          </Pressable>
          
          <Pressable 
            onPress={stopStream} 
            style={createChromeButtonStyle(false, winampTheme)}
          >
            <Ionicons name="stop" size={16} color={colors.textPrimary} />
          </Pressable>
          
          <Pressable 
            onPress={() => setStreamVolume(Math.min(1, volume + 0.1))} 
            style={createChromeButtonStyle(false, winampTheme)}
          >
            <Ionicons name="add" size={16} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Recording Section - Winamp Style */}
        <View style={{
          marginTop: WinampDesign.spacing.md,
          backgroundColor: colors.chromeBg,
          padding: WinampDesign.spacing.md,
          borderRadius: 4,
          ...WinampDesign.borders.chrome
        }}>
          <Text style={{
            ...WinampDesign.fonts.display,
            color: colors.textPrimary,
            fontSize: 10,
            textTransform: "uppercase",
            marginBottom: WinampDesign.spacing.sm
          }}>RECORDING</Text>
          <RecordControls url={streamConfig?.url} />
          
          {/* Recording Presets */}
          <View style={{ marginTop: WinampDesign.spacing.sm, flexDirection: "row", gap: WinampDesign.spacing.sm }}>
            <RecordingPresetButton duration={5} />
            <RecordingPresetButton duration={15} />
            <RecordingPresetButton duration={30} />
          </View>
        </View>

        {/* EQ-Style Buffer Display */}
        <View style={{
          marginTop: WinampDesign.spacing.md,
          backgroundColor: colors.darkBg,
          padding: WinampDesign.spacing.md,
          borderRadius: 4,
          ...WinampDesign.borders.chrome
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: WinampDesign.spacing.sm }}>
            <Text style={{
              ...WinampDesign.fonts.display,
              color: colors.textSecondary,
              fontSize: 10,
              textTransform: "uppercase"
            }}>BUFFER</Text>
            <Text style={{
              ...createLedTextStyle(winampTheme),
              fontSize: 10
            }}>{Math.round(bufferHealth)}%</Text>
          </View>
          
          {/* Classic EQ-style bars */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: 20 }}>
            {Array.from({ length: 20 }, (_, i) => {
              const segmentValue = (i + 1) * 5; // 5%, 10%, 15%, etc.
              const isActive = bufferHealth >= segmentValue;
              const segmentColor = segmentValue <= 60 ? colors.ledGreen : 
                                 segmentValue <= 80 ? colors.ledOrange : colors.ledRed;
              
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: Math.max(2, (i + 1) * 1.5), // Graduated heights
                    backgroundColor: isActive ? segmentColor : colors.ledOff,
                    borderRadius: 1,
                    marginRight: i < 19 ? 1 : 0,
                    shadowColor: isActive ? segmentColor : "transparent",
                    shadowOffset: { width: 0, height: 0 },
                    shadowRadius: 1,
                    shadowOpacity: 0.6
                  }}
                />
              );
            })}
          </View>
        </View>

        {/* Favorites - Winamp Preset Style */}
        <View style={{
          marginTop: WinampDesign.spacing.md,
          backgroundColor: colors.chromeBg,
          padding: WinampDesign.spacing.md,
          borderRadius: 4,
          ...WinampDesign.borders.chrome
        }}>
          <Text style={{
            ...WinampDesign.fonts.display,
            color: colors.textPrimary,
            fontSize: 10,
            textTransform: "uppercase",
            marginBottom: WinampDesign.spacing.sm
          }}>PRESETS</Text>
          <FavoritesRow />
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

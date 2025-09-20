import React, { useRef, useMemo, useEffect, useState } from "react";
import { View, Dimensions, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { useSharedValue, useAnimatedScrollHandler, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import TimelineHeader from "./TimelineHeader";
import TrackHeader from "./TrackHeader";
import TrackLane from "./TrackLane";
import PlayheadCursor from "./PlayheadCursor";
import ZoomControls from "./ZoomControls";
import { Track, AudioSegment, TimelineViewport } from "../../state/audioStore";

const { width: screenWidth } = Dimensions.get("window");

export type MultitrackTimelineProps = {
  tracks: Track[];
  segments: AudioSegment[];
  viewport: TimelineViewport;
  durationMs: number;
  positionMs: number;
  isPlaying: boolean;
  onSeek: (ms: number) => void;
  onViewportChange: (viewport: Partial<TimelineViewport>) => void;
  onTrackUpdate: (trackId: string, patch: Partial<Track>) => void;
  onSegmentUpdate: (segmentId: string, patch: Partial<AudioSegment>) => void;

  onAddTrack: () => void;
  onRemoveTrack: (trackId: string) => void;
  onAddClipToTrack?: (trackId: string) => void;
  editable?: boolean;
};

const DEFAULT_VIEWPORT: TimelineViewport = {
  startMs: 0,
  endMs: 60000, // 1 minute default
  pixelsPerMs: 0.1,
  snapToGrid: true,
  gridSizeMs: 1000, // 1 second grid
  followPlayhead: false,
};

const TRACK_HEIGHT = 60; // Reduced for mobile
const HEADER_WIDTH = 120; // Reduced for mobile
const MIN_ZOOM = 0.02; // 50ms per pixel (very zoomed out)
const MAX_ZOOM = 0.5; // 2ms per pixel (very zoomed in)

export default function MultitrackTimeline({
  tracks,
  segments,
  viewport: propViewport,
  durationMs,
  positionMs,
  isPlaying,
  onSeek,
  onViewportChange,
  onTrackUpdate,
  onSegmentUpdate,
  onAddTrack,
  onRemoveTrack,
  onAddClipToTrack,
  editable = true,
}: MultitrackTimelineProps) {
  const viewport = { ...DEFAULT_VIEWPORT, ...propViewport };
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const timelineScrollX = useSharedValue(0);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  
  // Track drag state
  const [draggedTrackId, setDraggedTrackId] = React.useState<string | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = React.useState<number>(-1);
  
  // Calculate timeline dimensions for mobile
  const availableWidth = screenWidth - HEADER_WIDTH;
  const timelineWidth = Math.max(availableWidth, durationMs * viewport.pixelsPerMs!);
  const visibleDuration = availableWidth / viewport.pixelsPerMs!;
  
  // Mobile-friendly zoom presets
  const zoomPresets = [
    { label: "Fit All", pixelsPerMs: availableWidth / durationMs },
    { label: "30s", pixelsPerMs: availableWidth / 30000 },
    { label: "1min", pixelsPerMs: availableWidth / 60000 },
    { label: "5min", pixelsPerMs: availableWidth / 300000 },
  ].filter(preset => preset.pixelsPerMs >= MIN_ZOOM && preset.pixelsPerMs <= MAX_ZOOM);
  
  // Sort tracks by index
  const sortedTracks = useMemo(() => 
    [...tracks].sort((a, b) => a.index - b.index), 
    [tracks]
  );

  // Group segments by track
  const segmentsByTrack = useMemo(() => {
    const grouped: Record<string, AudioSegment[]> = {};
    segments.forEach(segment => {
      if (!grouped[segment.trackId]) {
        grouped[segment.trackId] = [];
      }
      grouped[segment.trackId].push(segment);
    });
    return grouped;
  }, [segments]);

  // Keep a safe ref for onViewportChange
  const onViewportChangeRef = useRef(onViewportChange);
  useEffect(() => { onViewportChangeRef.current = onViewportChange; }, [onViewportChange]);
  const handleViewportChange = (startMs: number, endMs: number) => {
    onViewportChangeRef.current?.({ startMs, endMs });
  };

  // Drag hover + autoscroll helpers
  const scrollXRef = useRef(0);
  const updateScrollXRef = (x: number) => { scrollXRef.current = x; };
  const handleDragHover = (hoverIndex: number) => {
    if (hoverIndex >= 0 && hoverIndex < sortedTracks.length) {
      setDragTargetIndex(hoverIndex);
    } else {
      setDragTargetIndex(-1);
    }
  };
  const handleAutoScroll = (absoluteX: number) => {
    const edge = 24;
    const dir = absoluteX < edge ? -1 : absoluteX > (screenWidth - edge) ? 1 : 0;
    if (dir === 0) return;
    const step = Math.max(6, Math.floor(availableWidth * 0.02));
    const next = Math.max(0, Math.min(timelineWidth - availableWidth, (scrollXRef.current || 0) + dir * step));
    scrollViewRef.current?.scrollTo({ x: next, animated: false });
  };

  // Safe ref for onSeek used from worklets
  const onSeekRef = useRef(onSeek);
  useEffect(() => { onSeekRef.current = onSeek; }, [onSeek]);
  const onSeekJS = (ms: number) => {
    onSeekRef.current?.(ms);
  };

  // Handle timeline scroll
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      timelineScrollX.value = event.contentOffset.x;
      const newStartMs = event.contentOffset.x / viewport.pixelsPerMs!;
      const newEndMs = newStartMs + visibleDuration;
      runOnJS(handleViewportChange)(newStartMs, newEndMs);
      runOnJS(updateScrollXRef)(event.contentOffset.x);
    },
  });



  // Handle zoom changes
  const handleZoomChange = (newPixelsPerMs: number) => {
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newPixelsPerMs));
    onViewportChange({ pixelsPerMs: clampedZoom });
  };

  // Handle track reordering
  const handleTrackReorder = (fromIndex: number, toIndex: number) => {
    if (!editable) return;
    
    const reorderedTracks = [...sortedTracks];
    const [movedTrack] = reorderedTracks.splice(fromIndex, 1);
    reorderedTracks.splice(toIndex, 0, movedTrack);
    
    // Update track indices
    reorderedTracks.forEach((track, index) => {
      onTrackUpdate(track.id, { index });
    });
  };

  // Handle drag start
  const handleDragStart = (trackId: string) => {
    setDraggedTrackId(trackId);
  };

  // Handle drag end
  const handleDragEnd = (fromTrackId: string, toIndex: number) => {
    const fromTrack = tracks.find(t => t.id === fromTrackId);
    if (fromTrack && toIndex !== fromTrack.index && toIndex >= 0 && toIndex < tracks.length) {
      handleTrackReorder(fromTrack.index, toIndex);
    }
    setDraggedTrackId(null);
    setDragTargetIndex(-1);
  };

  const timelineTapGesture = Gesture.Tap()
    .onEnd((event, success) => {
      "worklet";
      if (!success || !editable) return;
      try {
        const px = timelineScrollX.value + event.x;
        const ppm = viewport.pixelsPerMs || 0.1;
        if (!isFinite(px) || !isFinite(ppm) || ppm <= 0) return;
        const timeMs = px / ppm;
        const clamped = Math.max(0, Math.min(timeMs, durationMs));
         runOnJS(onSeekJS)(clamped);
         runOnJS(setSelectedSegmentId)(null);
      } catch {}
    });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1">
        {/* Zoom Controls */}
        <ZoomControls
          pixelsPerMs={viewport.pixelsPerMs!}
          onZoomChange={handleZoomChange}
          onFitToWindow={() => {
            const newPixelsPerMs = availableWidth / durationMs;
            handleZoomChange(newPixelsPerMs);
          }}
          onToggleSnap={() => onViewportChange({ snapToGrid: !viewport.snapToGrid })}
          snapEnabled={viewport.snapToGrid!}
          zoomPresets={zoomPresets}
          onFitSelection={() => {
            if (!selectedSegmentId) return;
            const allSegments = Object.values(segmentsByTrack).flat();
            const seg = allSegments.find(s => s.id === selectedSegmentId);
            if (!seg) return;
            const pad = 0.1 * (seg.endMs - seg.startMs);
            const start = Math.max(0, seg.startMs - pad);
            const end = Math.min(durationMs, seg.endMs + pad);
            const ppm = availableWidth / Math.max(200, end - start);
            handleZoomChange(ppm);
            const x = Math.max(0, Math.min(timelineWidth - availableWidth, start * ppm));
            scrollViewRef.current?.scrollTo({ x, animated: true });
          }}
          onToggleFollow={() => onViewportChange({ followPlayhead: !viewport.followPlayhead })}
          followEnabled={!!viewport.followPlayhead}
        />

        {/* Timeline Header */}
        <View className="flex-row">
          <View style={{ width: HEADER_WIDTH }} className="bg-white border-r border-gray-200">
            {/* Master controls placeholder */}
          </View>
          <View className="flex-1">
            <TimelineHeader
              durationMs={durationMs}
              viewport={viewport}
              timelineWidth={timelineWidth}
              onSeek={onSeek}
            />
          </View>
        </View>

        {/* Tracks Area */}
        <View className="flex-1 flex-row">
          {/* Track Headers - Fixed height for mobile */}
          <View style={{ width: HEADER_WIDTH }} className="bg-gray-100 border-r border-gray-200">
            <View style={{ height: sortedTracks.length * TRACK_HEIGHT }}>
              {sortedTracks.map((track, index) => (
                <TrackHeader
                  key={track.id}
                  track={track}
                  height={TRACK_HEIGHT}
                  onUpdate={(patch) => onTrackUpdate(track.id, patch)}
                  onRemove={() => onRemoveTrack(track.id)}
                  onReorder={(direction) => {
                    const newIndex = direction === "up" ? index - 1 : index + 1;
                    if (newIndex >= 0 && newIndex < sortedTracks.length) {
                      handleTrackReorder(index, newIndex);
                    }
                  }}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedTrackId === track.id}
                  dragOffset={dragTargetIndex >= 0 ? (dragTargetIndex - index) * TRACK_HEIGHT : 0}
                  editable={editable}
                />
              ))}
            </View>
            
            {/* Add Track Button - Fixed at bottom */}
            {editable && (
              <View style={{ height: 40 }} className="justify-center items-center border-t border-gray-300 bg-gray-50">
                <Pressable
                  onPress={onAddTrack}
                  className="px-3 py-1 bg-blue-600 rounded-lg"
                >
                  <Text className="text-white text-xs font-medium">+ Add Track</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Timeline Lanes - Optimized for Mobile */}
          <View className="flex-1">
            <GestureDetector gesture={timelineTapGesture}>
              <Animated.ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={true}
                onScroll={scrollHandler}
                scrollEventThrottle={8}
                contentContainerStyle={{ width: timelineWidth }}
                decelerationRate="fast"
                bounces={false}
              >
                <View style={{ width: timelineWidth, position: "relative" }}>
                  {/* Playhead Cursor */}
                  <PlayheadCursor
                    positionMs={positionMs}
                    pixelsPerMs={viewport.pixelsPerMs!}
                    height={sortedTracks.length * TRACK_HEIGHT}
                    isPlaying={isPlaying}
                  />

                  {/* Track Lanes - No nested ScrollView for better performance */}
                  <View style={{ height: sortedTracks.length * TRACK_HEIGHT }}>
                     {sortedTracks.map((track, index) => (
                        <TrackLane
                         key={track.id}
                         track={track}
                         segments={segmentsByTrack[track.id] || []}
                         height={TRACK_HEIGHT}
                         width={timelineWidth}
                         viewport={viewport}
                         durationMs={durationMs}
                         onSegmentUpdate={onSegmentUpdate}
                         onSegmentMove={(segmentId: string, newTrackId: string, newStartMs: number) => {
                           const allSegments = Object.values(segmentsByTrack).flat();
                           const segment = allSegments.find(s => s.id === segmentId);
                           if (segment && segment.trackId !== newTrackId) {
                             const duration = segment.endMs - segment.startMs;
                             onSegmentUpdate(segmentId, {
                               trackId: newTrackId,
                               startMs: newStartMs,
                               endMs: newStartMs + duration
                             });
                           }
                         }}
                         allTracks={sortedTracks}
                         trackIndex={index}
                         editable={editable}
                         selectedSegmentId={selectedSegmentId}
                         onSelectSegment={setSelectedSegmentId}
                         isDragTarget={dragTargetIndex === index}
                         onDragHover={handleDragHover}
                         onAutoScroll={handleAutoScroll}
                       />
                     ))}
                  </View>
                </View>
              </Animated.ScrollView>
            </GestureDetector>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
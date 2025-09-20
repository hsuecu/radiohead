import React from "react";
import { View } from "react-native";
import { Track, AudioSegment, TimelineViewport } from "../../state/audioStore";
import AudioSegmentBlock from "./AudioSegmentBlock";

export type TrackLaneProps = {
  track: Track;
  segments: AudioSegment[];
  height: number;
  width: number;
  viewport: TimelineViewport;
  durationMs: number;
  onSegmentUpdate: (segmentId: string, patch: Partial<AudioSegment>) => void;
  onSegmentMove?: (segmentId: string, newTrackId: string, newStartMs: number) => void;
  allTracks?: Track[];
  trackIndex?: number;
  editable?: boolean;
  selectedSegmentId?: string | null;
  onSelectSegment?: (id: string | null) => void;
  isDragTarget?: boolean;
  onDragHover?: (trackIndex: number) => void;
  onAutoScroll?: (absoluteX: number) => void;
};

export default function TrackLane({
  track,
  segments,
  height,
  width,
  viewport,
  durationMs,
  onSegmentUpdate,
  onSegmentMove,
  allTracks = [],
  trackIndex = 0,
  editable = true,
  selectedSegmentId = null,
  onSelectSegment,
  isDragTarget = false,
  onDragHover,
  onAutoScroll,
}: TrackLaneProps) {
  const pixelsPerMs = viewport.pixelsPerMs || 0.1;

  return (
    <View
      style={{
        height,
        width,
        backgroundColor: isDragTarget ? "#EFF6FF" : track.muted ? "#F9FAFB" : "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
        position: "relative",
      }}
    >
      {/* Track Background */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: track.soloed ? "#1E40AF" : "transparent",
          opacity: track.soloed ? 0.1 : 1,
        }}
      />

      {/* Grid Lines */}
      {viewport.snapToGrid && viewport.gridSizeMs && (
        <>
          {Array.from({ length: Math.ceil(durationMs / viewport.gridSizeMs) }, (_, i) => {
            const time = i * viewport.gridSizeMs!;
            const x = time * pixelsPerMs;
            return (
              <View
                key={`grid-${i}`}
                style={{
                  position: "absolute",
                  left: x,
                  top: 0,
                  bottom: 0,
                  width: 1,
                   backgroundColor: "#E5E7EB",
                   opacity: 1,
                }}
              />
            );
          })}
        </>
      )}

      {/* Audio Segments */}
      {segments.map((segment) => (
        <AudioSegmentBlock
          key={segment.id}
          segment={segment}
          track={track}
          pixelsPerMs={pixelsPerMs}
          trackHeight={height}
          onUpdate={(patch: Partial<AudioSegment>) => onSegmentUpdate(segment.id, patch)}
          onMove={onSegmentMove}
          onSelect={onSelectSegment}
          isSelected={selectedSegmentId === segment.id}
          snapToGrid={!!viewport.snapToGrid}
          gridSizeMs={viewport.gridSizeMs || 1000}
          allTracks={allTracks}
          trackIndex={trackIndex}
          editable={editable}
          onDragHover={onDragHover}
          onAutoScroll={onAutoScroll}
        />
      ))}

      {/* Drop Zone Indicator (when dragging) */}
      {/* This would be implemented with drag-and-drop context */}
    </View>
  );
}
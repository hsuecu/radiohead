export function buildRecordingMetadata({ stationId, userId, categoryCode, categoryName, subcategory, tags, notes, durationMs, trimStartMs, trimEndMs, version = 1, path, filename }: any) {
  const recordedAt = Date.now();
  return {
    station_id: stationId,
    user_id: userId,
    category_code: categoryCode,
    category_name: categoryName,
    subcategory,
    tags,
    notes,
    technical: { container: "m4a", duration_ms: durationMs, trim_start_ms: trimStartMs, trim_end_ms: trimEndMs },
    timestamps: { recorded_at: recordedAt },
    version,
    path,
    filename,
  };
}

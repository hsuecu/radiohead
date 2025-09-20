import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useScriptStore } from "../state/scriptStore";
import { streamRecorder } from "../utils/streamRecorder";

import { cn } from "../utils/cn";
// ScriptManagerModal removed per new header actions
import Animated, { useAnimatedRef, useSharedValue, useFrameCallback, withTiming, Easing, scrollTo, runOnJS } from "react-native-reanimated";

export default function AutocueScreen() {
  const {
    items,
    isPlaying,
    currentPosition,
    playbackSpeed,
    fontSize,
    startPlayback,
    pausePlayback,
    setPosition,
    setPlaybackSpeed,
    setFontSize,
    addManualItem,
    removeItem,
    updateItem,
    moveItem,
     saveCurrentScript,
     currentScript,
     clearScript,
     closeCurrentScript,
 
      setActiveScriptSession,
  } = useScriptStore();

  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemContent, setNewItemContent] = useState("");
  const [newItemPosition, setNewItemPosition] = useState<"top" | "bottom">("bottom");
  const [isRecording, setIsRecording] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  
  const animatedRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const playingSV = useSharedValue(false);
  const targetSpeedPxPerMs = useSharedValue(0);
  const smoothSpeedPxPerMs = useSharedValue(0);
  const contentH = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const endedSV = useSharedValue(false);

  const navigation = useNavigation<any>();
  const touchingSV = useSharedValue(false);
  const [isTouching, setIsTouching] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  const touchGesture = useMemo(
    () =>
      Gesture.Native()
        .onTouchesDown(() => {
          touchingSV.value = true;
          runOnJS(setIsTouching)(true);
        })
        .onTouchesUp(() => {
          touchingSV.value = false;
          runOnJS(setIsTouching)(false);
        })
        .onTouchesCancelled(() => {
          touchingSV.value = false;
          runOnJS(setIsTouching)(false);
        })
        .onFinalize(() => {
          touchingSV.value = false;
          runOnJS(setIsTouching)(false);
        }),
    []
  );

  // Keep playing flag in UI thread
  useEffect(() => { playingSV.value = isPlaying; }, [isPlaying]);

  // Smooth speed transitions on UI thread
  useEffect(() => {
    const lineHeight = fontSize * 1.25; // px per line
    const wordsPerLine = 7; // assumption
    const pxPerSec = (playbackSpeed / 60) * (lineHeight * (1 / wordsPerLine) * 7);
    const pxPerMs = pxPerSec / 1000;
    targetSpeedPxPerMs.value = pxPerMs;
    smoothSpeedPxPerMs.value = withTiming(pxPerMs, { duration: 250, easing: Easing.linear });
  }, [playbackSpeed, fontSize]);

  // Frame-driven scroll on UI thread
  useFrameCallback((frame) => {
    if (!playingSV.value || touchingSV.value) return;
    const dt = frame.timeSincePreviousFrame ?? 16;
    const maxY = Math.max(0, contentH.value - viewportH.value);
    const nextY = scrollY.value + smoothSpeedPxPerMs.value * dt;
    if (nextY >= Math.max(0, maxY - 0.5)) {
      scrollY.value = maxY;
      scrollTo(animatedRef, 0, maxY, false);
      if (!endedSV.value) {
        endedSV.value = true;
        runOnJS(pausePlayback)();
        runOnJS(setAtEnd)(true);
      }
      return;
    }
    scrollY.value = Math.min(maxY, Math.max(0, nextY));
    scrollTo(animatedRef, 0, scrollY.value, false);
  });

  // Mark session active when we open Autocue with a current script
  useEffect(() => {
    if (currentScript) {
      setActiveScriptSession(currentScript);
    }
  }, [currentScript]);

  // Monitor recording status
  useEffect(() => {
    const checkRecordingStatus = () => {
      const status = streamRecorder.getStatus();
      setIsRecording(status.status === "recording");
    };

    const interval = setInterval(checkRecordingStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync scroll position when not playing
  useEffect(() => {
    if (!isPlaying) {
      scrollY.value = currentPosition;
      try { scrollTo(animatedRef, 0, currentPosition, false); } catch {}
    } else {
      // reset end flag when starting playback again
      endedSV.value = false;
    }
  }, [currentPosition, isPlaying]);

  const handleAddItem = () => {
    if (newItemTitle.trim() && newItemContent.trim()) {
      addManualItem(newItemTitle.trim(), newItemContent.trim(), { position: newItemPosition });
      setNewItemTitle("");
      setNewItemContent("");
      setShowAddModal(false);
    }
  };

  // Confirm modals controlled by state below
  const handleDeleteConfirmed = () => {
    if (confirmDeleteId) removeItem(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const handleClearConfirmed = () => {
    clearScript();
    setConfirmClear(false);
  };

  const totalDuration = items.reduce((sum, item) => sum + (item.duration || 0), 0);
  const totalWords = items.reduce((sum, item) => sum + item.content.split(/\s+/).length, 0);

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="bg-black px-4 py-3 border-b border-gray-700">
        <View className="flex-row items-center justify-between">
          <Text className="text-white text-xl font-bold">Autocue</Text>
          <View className="flex-row items-center space-x-2">
            <Pressable onPress={() => setShowAddModal(true)} className="p-2 rounded-full bg-gray-800 mr-2">
              <Ionicons name="add" size={20} color="white" />
            </Pressable>
            <Pressable onPress={() => setShowSettings(true)} className="p-2 rounded-full bg-gray-800 mr-2">
              <Ionicons name="settings-outline" size={20} color="white" />
            </Pressable>
            <Pressable
              onPress={() => { pausePlayback(); closeCurrentScript(); try { navigation.navigate("Scripts"); } catch {} }}
              className="p-2 rounded-full bg-gray-800"
            >
              <Ionicons name="close" size={20} color="white" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Inline Banners */}
      {isRecording && (
        <View className="bg-red-600 px-4 py-2">
          <Text className="text-white text-center font-medium">🔴 RECORDING - Autocue Active</Text>
        </View>
      )}
      {banner && (
        <View className="bg-green-600 px-4 py-2">
          <Text className="text-white text-center font-medium">{banner}</Text>
        </View>
      )}

      {/* Script Stats */}
      <View className="bg-gray-900 px-4 py-3 border-b border-gray-700">
        <View className="flex-row justify-between items-center">
          <Text className="text-gray-300 text-sm">
            {items.length} items • {totalWords} words
          </Text>
          <Text className="text-gray-300 text-sm">
            Est. {Math.ceil(totalDuration / 60)}min read
          </Text>
        </View>
      </View>

      {/* Playback Controls */}
      <View className="bg-gray-900 px-4 py-3 border-b border-gray-700">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center space-x-4">
            <Pressable
              onPress={isPlaying ? pausePlayback : startPlayback}
              className="p-3 rounded-full bg-blue-600"
              disabled={items.length === 0}
            >
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={24} 
                color="white" 
              />
            </Pressable>
            
            <Pressable
              onPress={() => setPosition(0)}
              className="p-2 rounded-full bg-gray-700"
            >
              <Ionicons name="refresh" size={20} color="white" />
            </Pressable>
          </View>

          <View className="flex-row items-center space-x-4">
            <Text className="text-gray-300 text-sm">
              {playbackSpeed} WPM
            </Text>
            <Text className="text-gray-300 text-sm">
              {fontSize}px
            </Text>
          </View>
        </View>
      </View>

      {/* Script Content */}
      <GestureDetector gesture={touchGesture}>
        <Animated.ScrollView
          ref={animatedRef}
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 64 }}
          onLayout={(e) => { try { viewportH.value = e.nativeEvent.layout.height; } catch {} }}
          onContentSizeChange={(_, h) => { try { contentH.value = h; } catch {} }}
          onScroll={(event: any) => {
            const y = event.nativeEvent.contentOffset.y;
            const contentHeight = event.nativeEvent.contentSize?.height ?? contentH.value;
            const viewportHeight = event.nativeEvent.layoutMeasurement?.height ?? viewportH.value;
            const maxY = Math.max(0, contentHeight - viewportHeight);
            scrollY.value = y;
            if (!isPlaying || isTouching) {
              setPosition(y);
            }
            setAtEnd(y >= Math.max(0, maxY - 24));
          }}
          scrollEventThrottle={16}
        >
          {items.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20">
              <Ionicons name="document-text-outline" size={64} color="#6B7280" />
              <Text className="text-gray-400 text-lg mt-4 mb-2">No script items</Text>
              <Text className="text-gray-500 text-center mb-6">Add items to your script to get started</Text>
              <Pressable onPress={() => setShowAddModal(true)} className="bg-blue-600 px-6 py-3 rounded-lg">
                <Text className="text-white font-medium">Add First Item</Text>
              </Pressable>
            </View>
          ) : (
            <View className="py-4">
              {items.map((item, index) => (
                <ScriptItem
                  key={item.id}
                  item={item}
                  index={index}
                  isEditing={isEditing}
                  fontSize={fontSize}
                  onDelete={() => setConfirmDeleteId(item.id)}
                  onUpdate={(updates) => updateItem(item.id, updates)}
                  onMoveUp={() => moveItem(item.id, "up")}
                  onMoveDown={() => moveItem(item.id, "down")}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                />
              ))}
              <View style={{ height: 120 }} />
            </View>
          )}
        </Animated.ScrollView>
      </GestureDetector>

      {atEnd && items.length > 0 && (
        <View className="absolute left-4 right-4 bg-gray-900/90 border border-gray-700 rounded-xl px-4 py-3" style={{ bottom: 32 }}>
          <Text className="text-gray-200 mb-2 text-center">Reached end</Text>
          <View className="flex-row justify-center">
            <Pressable onPress={() => navigation.goBack()} className="px-4 py-2 rounded-lg bg-gray-700 mr-2">
              <Text className="text-white">Close</Text>
            </Pressable>
            <Pressable
              onPress={() => { pausePlayback(); setPosition(0); endedSV.value = false; setAtEnd(false); try { scrollTo(animatedRef, 0, 0, false); } catch {} }}
              className="px-4 py-2 rounded-lg bg-blue-600"
            >
              <Text className="text-white">Scroll to Top</Text>
            </Pressable>
          </View>
        </View>
      )}
      {/* Floating Action Button */}
      {!isEditing && (
        <Pressable
          onPress={() => setShowAddModal(true)}
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg"
        >
          <Ionicons name="add" size={28} color="white" />
        </Pressable>
      )}

      {/* Edit Mode Actions */}
      {isEditing && (
        <View className="bg-gray-900 px-4 py-3 border-t border-gray-700">
          <View className="flex-row justify-between">
            <Pressable onPress={() => setShowAddModal(true)} className="flex-1 bg-blue-600 py-3 rounded-lg mr-2 items-center">
              <Text className="text-white font-medium">Add Item</Text>
            </Pressable>
            <Pressable onPress={() => { saveCurrentScript(); setBanner("Saved script"); setTimeout(()=>setBanner(null), 1500); }} className="flex-1 bg-green-600 py-3 rounded-lg mx-2 items-center" disabled={items.length === 0}>
              <Text className="text-white font-medium">Save</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmClear(true)} className="flex-1 bg-red-600 py-3 rounded-lg ml-2 items-center" disabled={items.length === 0}>
              <Text className="text-white font-medium">Clear All</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-black">
          <View className="flex-row items-center justify-between p-4 border-b border-gray-700">
            <Pressable onPress={() => setShowAddModal(false)}>
              <Text className="text-blue-500 text-lg">Cancel</Text>
            </Pressable>
            <Text className="text-white text-lg font-medium">Add Script Item</Text>
            <Pressable onPress={handleAddItem}>
              <Text className="text-blue-500 text-lg font-medium">Add</Text>
            </Pressable>
          </View>

          <View className="flex-1 p-4">
            <Text className="text-white text-lg mb-2">Title</Text>
            <TextInput value={newItemTitle} onChangeText={setNewItemTitle} placeholder="Enter item title..." placeholderTextColor="#6B7280" className="bg-gray-800 text-white p-3 rounded-lg mb-4" />

            <Text className="text-white text-lg mb-2">Content</Text>
            <TextInput value={newItemContent} onChangeText={setNewItemContent} placeholder="Enter script content..." placeholderTextColor="#6B7280" className="bg-gray-800 text-white p-3 rounded-lg flex-1" multiline textAlignVertical="top" />

            <View className="mt-4">
              <Text className="text-white text-lg mb-2">Insert position</Text>
              <View className="flex-row bg-gray-800 rounded-xl p-1">
                <Pressable onPress={() => setNewItemPosition("top")} className={`flex-1 px-3 py-2 rounded-lg ${newItemPosition === "top" ? "bg-gray-700" : ""}`}><Text className="text-white text-center">Top</Text></Pressable>
                <Pressable onPress={() => setNewItemPosition("bottom")} className={`flex-1 px-3 py-2 rounded-lg ${newItemPosition === "bottom" ? "bg-gray-700" : ""}`}><Text className="text-white text-center">Bottom</Text></Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-black">
          <View className="flex-row items-center justify-between p-4 border-b border-gray-700">
            <Pressable onPress={() => setShowSettings(false)}>
              <Text className="text-blue-500 text-lg">Done</Text>
            </Pressable>
            <Text className="text-white text-lg font-medium">Autocue Settings</Text>
            <View style={{ width: 60 }} />
          </View>

          <View className="flex-1 p-4">
            <View className="mb-6">
              <Text className="text-white text-lg mb-3">Playback Speed</Text>
              <View className="flex-row items-center justify-between">
                <Pressable onPress={() => setPlaybackSpeed(playbackSpeed - 10)} className="bg-gray-700 p-3 rounded-lg"><Ionicons name="remove" size={20} color="white" /></Pressable>
                <Text className="text-white text-xl">{playbackSpeed} WPM</Text>
                <Pressable onPress={() => setPlaybackSpeed(playbackSpeed + 10)} className="bg-gray-700 p-3 rounded-lg"><Ionicons name="add" size={20} color="white" /></Pressable>
              </View>
            </View>

            <View className="mb-6">
              <Text className="text-white text-lg mb-3">Font Size</Text>
              <View className="flex-row items-center justify-between">
                <Pressable onPress={() => setFontSize(fontSize - 2)} className="bg-gray-700 p-3 rounded-lg"><Ionicons name="remove" size={20} color="white" /></Pressable>
                <Text className="text-white text-xl">{fontSize}px</Text>
                <Pressable onPress={() => setFontSize(fontSize + 2)} className="bg-gray-700 p-3 rounded-lg"><Ionicons name="add" size={20} color="white" /></Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Confirm Delete Item Modal */}
      <Modal visible={!!confirmDeleteId} transparent animationType="fade" onRequestClose={() => setConfirmDeleteId(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View className="bg-white rounded-2xl p-4 w-full">
            <Text className="text-lg font-semibold text-gray-800">Delete item?</Text>
            <Text className="text-gray-600 mt-1">This cannot be undone.</Text>
            <View className="flex-row justify-end mt-3">
              <Pressable onPress={() => setConfirmDeleteId(null)} className="px-3 py-2 rounded-full bg-gray-200 mr-2"><Text className="text-gray-700">Cancel</Text></Pressable>
              <Pressable onPress={handleDeleteConfirmed} className="px-3 py-2 rounded-full bg-red-600"><Text className="text-white">Delete</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Clear Script Modal */}
      <Modal visible={confirmClear} transparent animationType="fade" onRequestClose={() => setConfirmClear(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View className="bg-white rounded-2xl p-4 w-full">
            <Text className="text-lg font-semibold text-gray-800">Clear script?</Text>
            <Text className="text-gray-600 mt-1">Remove all items from the current script.</Text>
            <View className="flex-row justify-end mt-3">
              <Pressable onPress={() => setConfirmClear(false)} className="px-3 py-2 rounded-full bg-gray-200 mr-2"><Text className="text-gray-700">Cancel</Text></Pressable>
              <Pressable onPress={handleClearConfirmed} className="px-3 py-2 rounded-full bg-red-600"><Text className="text-white">Clear</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>


    </SafeAreaView>
  );
}

interface ScriptItemProps {
  item: any;
  index: number;
  isEditing: boolean;
  fontSize: number;
  onDelete: () => void;
  onUpdate: (updates: any) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function ScriptItem({ item, index, isEditing, fontSize, onDelete, onUpdate, onMoveUp, onMoveDown, isFirst, isLast }: ScriptItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingContent, setEditingContent] = useState(item.content);

  const handleSaveEdit = () => {
    onUpdate({ content: editingContent });
    setIsExpanded(false);
  };

  return (
    <View className="mb-4 bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        className="p-4 flex-row items-center justify-between"
      >
        <View className="flex-1">
          <Text className="text-white font-medium text-lg">{item.title}</Text>
          <View className="flex-row items-center mt-1">
            <Text className="text-gray-400 text-sm">#{index + 1}</Text>
            {item.source && (
              <Text className="text-gray-400 text-sm ml-2">• {item.source}</Text>
            )}
            {item.duration && (
              <Text className="text-gray-400 text-sm ml-2">
                • {Math.ceil(item.duration / 60)}min
              </Text>
            )}
          </View>
        </View>

        <View className="flex-row items-center">
          {isEditing && (
            <>
              <Pressable
                onPress={onMoveUp}
                disabled={isFirst}
                className={`p-2 rounded-full mr-2 ${isFirst ? "bg-gray-800 opacity-40" : "bg-gray-700"}`}
                accessibilityLabel="Move up"
                hitSlop={10}
              >
                <Ionicons name="arrow-up" size={16} color="white" />
              </Pressable>
              <Pressable
                onPress={onMoveDown}
                disabled={isLast}
                className={`p-2 rounded-full mr-2 ${isLast ? "bg-gray-800 opacity-40" : "bg-gray-700"}`}
                accessibilityLabel="Move down"
                hitSlop={10}
              >
                <Ionicons name="arrow-down" size={16} color="white" />
              </Pressable>
              <Pressable onPress={onDelete} className="p-2 rounded-full bg-red-600 mr-2" accessibilityLabel="Delete item" hitSlop={10}>
                <Ionicons name="trash-outline" size={16} color="white" />
              </Pressable>
            </>
          )}
          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
        </View>
      </Pressable>

      {/* Content */}
      {isExpanded && (
        <View className="px-4 pb-4 border-t border-gray-700">
          {isEditing ? (
            <View className="mt-3">
              <TextInput
                value={editingContent}
                onChangeText={setEditingContent}
                className="bg-gray-800 text-white p-3 rounded-lg mb-3"
                style={{ fontSize, minHeight: 100 }}
                multiline
                textAlignVertical="top"
              />
              <View className="flex-row justify-end space-x-2">
                <Pressable
                  onPress={() => {
                    setEditingContent(item.content);
                    setIsExpanded(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-700"
                >
                  <Text className="text-white">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveEdit}
                  className="px-4 py-2 rounded-lg bg-blue-600"
                >
                  <Text className="text-white">Save</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text
              className="text-gray-200 mt-3 leading-relaxed"
              style={{ fontSize }}
            >
              {item.content}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
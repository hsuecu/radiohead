import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSocialMediaStore, SocialMediaPost, SocialPlatform } from "../state/socialMediaStore";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";

export default function SocialMediaScreen() {
  const {
    posts,
    config,
    addPost,
    updatePost,
    deletePost,
    schedulePost,
    publishPost,
    publishAllScheduled,
    updateConfig,
  } = useSocialMediaStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<SocialMediaPost | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | "scheduled" | "posted">("all");

  // Auto-publish scheduled posts
  useEffect(() => {
    const interval = setInterval(() => {
      publishAllScheduled();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [publishAllScheduled]);

  const filteredPosts = posts.filter(post => {
    if (filter === "all") return true;
    return post.status === filter;
  });

  const handleDeletePost = (post: SocialMediaPost) => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deletePost(post.id) },
      ]
    );
  };



  const enabledPlatforms = Object.entries(config)
    .filter(([_, platformConfig]) => platformConfig.enabled)
    .map(([platform]) => platform as SocialPlatform);

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-gray-900">Social Media</Text>
          <View className="flex-row items-center space-x-2">
            <Pressable
              onPress={() => setShowConfigModal(true)}
              className="p-2 rounded-full bg-gray-100"
            >
              <Ionicons name="settings-outline" size={20} color="#6B7280" />
            </Pressable>
            <Pressable
              onPress={() => setShowCreateModal(true)}
              className="bg-blue-600 px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-medium">Create Post</Text>
            </Pressable>
          </View>
        </View>

        {/* Platform Status */}
        <View className="flex-row items-center mt-3 space-x-4">
          {enabledPlatforms.length > 0 ? (
            enabledPlatforms.map((platform) => (
              <View key={platform} className="flex-row items-center">
                <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                <Text className="text-sm text-gray-600 capitalize">{platform}</Text>
              </View>
            ))
          ) : (
            <Text className="text-sm text-gray-500">No platforms configured</Text>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="bg-white border-b border-gray-200">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
          <View className="flex-row py-3 space-x-4">
            {["all", "draft", "scheduled", "posted"].map((filterOption) => (
              <Pressable
                key={filterOption}
                onPress={() => setFilter(filterOption as any)}
                className={`px-3 py-1 rounded-full ${
                  filter === filterOption ? "bg-blue-100" : "bg-gray-100"
                }`}
              >
                <Text className={`text-sm font-medium capitalize ${
                  filter === filterOption ? "text-blue-700" : "text-gray-600"
                }`}>
                  {filterOption} ({posts.filter(p => filterOption === "all" || p.status === filterOption).length})
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Posts List */}
      <ScrollView className="flex-1 px-4 py-4">
        {filteredPosts.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="megaphone-outline" size={64} color="#D1D5DB" />
            <Text className="text-gray-500 text-lg mt-4">No posts yet</Text>
            <Text className="text-gray-400 text-center mt-2">
              Create your first social media post to get started
            </Text>
            <Pressable
              onPress={() => setShowCreateModal(true)}
              className="bg-blue-600 px-6 py-3 rounded-lg mt-4"
            >
              <Text className="text-white font-medium">Create Post</Text>
            </Pressable>
          </View>
        ) : (
          <View className="space-y-4">
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onEdit={() => setSelectedPost(post)}
                onDelete={() => handleDeletePost(post)}
                onPublish={() => publishPost(post.id)}
                onSchedule={(date) => schedulePost(post.id, date.toISOString())}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Post Modal */}
      <CreatePostModal
        visible={showCreateModal || selectedPost !== null}
        post={selectedPost}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedPost(null);
        }}
        onSave={(postData) => {
          if (selectedPost) {
            updatePost(selectedPost.id, postData);
          } else {
            addPost(postData);
          }
          setShowCreateModal(false);
          setSelectedPost(null);
        }}
      />

      {/* Configuration Modal */}
      <ConfigModal
        visible={showConfigModal}
        config={config}
        onClose={() => setShowConfigModal(false)}
        onUpdateConfig={updateConfig}
      />
    </SafeAreaView>
  );
}

interface PostCardProps {
  post: SocialMediaPost;
  onEdit: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onSchedule: (date: Date) => void;
}

function PostCard({ post, onEdit, onDelete, onPublish, onSchedule }: PostCardProps) {
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date());

  const getStatusColor = (status: SocialMediaPost["status"]) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-700";
      case "scheduled": return "bg-blue-100 text-blue-700";
      case "posting": return "bg-yellow-100 text-yellow-700";
      case "posted": return "bg-green-100 text-green-700";
      case "failed": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const handleSchedule = () => {
    onSchedule(scheduleDate);
    setShowSchedulePicker(false);
  };

  return (
    <View className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Header */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <View className="flex-row items-center mb-2">
            <View className={`px-2 py-1 rounded-full ${getStatusColor(post.status)}`}>
              <Text className="text-xs font-medium capitalize">{post.status}</Text>
            </View>
            {post.scheduledFor && (
              <Text className="text-xs text-gray-500 ml-2">
                Scheduled: {new Date(post.scheduledFor).toLocaleString()}
              </Text>
            )}
          </View>
          
          {/* Platforms */}
          <View className="flex-row items-center space-x-2">
            {post.platforms.map((platform) => (
              <View key={platform} className="bg-gray-100 px-2 py-1 rounded">
                <Text className="text-xs text-gray-600 capitalize">{platform}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable onPress={onDelete} className="p-1">
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </Pressable>
      </View>

      {/* Content */}
      <Text className="text-gray-900 mb-3" numberOfLines={3}>
        {post.content}
      </Text>

      {/* Image Preview */}
      {post.imageUri && (
        <Image
          source={{ uri: post.imageUri }}
          className="w-full h-32 rounded-lg mb-3"
          resizeMode="cover"
        />
      )}

      {/* Source Info */}
      {post.sourceContent && (
        <View className="bg-gray-50 p-2 rounded mb-3">
          <Text className="text-xs text-gray-500">
            Source: {post.sourceContent.title}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center space-x-2">
          <Pressable
            onPress={onEdit}
            className="bg-gray-100 px-3 py-1 rounded"
          >
            <Text className="text-gray-700 text-sm">Edit</Text>
          </Pressable>
          
          {post.status === "draft" && (
            <>
              <Pressable
                onPress={() => setShowSchedulePicker(true)}
                className="bg-blue-100 px-3 py-1 rounded"
              >
                <Text className="text-blue-700 text-sm">Schedule</Text>
              </Pressable>
              <Pressable
                onPress={onPublish}
                className="bg-green-100 px-3 py-1 rounded"
              >
                <Text className="text-green-700 text-sm">Publish Now</Text>
              </Pressable>
            </>
          )}
        </View>

        <Text className="text-xs text-gray-400">
          {new Date(post.createdAt).toLocaleDateString()}
        </Text>
      </View>

      {/* Schedule Date Picker */}
      {showSchedulePicker && (
        <Modal transparent animationType="fade">
          <View className="flex-1 bg-black bg-opacity-50 items-center justify-center">
            <View className="bg-white rounded-lg p-4 m-4">
              <Text className="text-lg font-medium mb-4">Schedule Post</Text>
              <DateTimePicker
                value={scheduleDate}
                mode="datetime"
                display="default"
                onChange={(_, selectedDate) => {
                  if (selectedDate) setScheduleDate(selectedDate);
                }}
                minimumDate={new Date()}
              />
              <View className="flex-row justify-end space-x-2 mt-4">
                <Pressable
                  onPress={() => setShowSchedulePicker(false)}
                  className="px-4 py-2 rounded bg-gray-100"
                >
                  <Text className="text-gray-700">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSchedule}
                  className="px-4 py-2 rounded bg-blue-600"
                >
                  <Text className="text-white">Schedule</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

interface CreatePostModalProps {
  visible: boolean;
  post: SocialMediaPost | null;
  onClose: () => void;
  onSave: (postData: any) => void;
}

function CreatePostModal({ visible, post, onClose, onSave }: CreatePostModalProps) {
  const { config } = useSocialMediaStore();
  const [content, setContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
  const [imageUri, setImageUri] = useState<string | undefined>();

  useEffect(() => {
    if (post) {
      setContent(post.content);
      setSelectedPlatforms(post.platforms);
      setImageUri(post.imageUri);
    } else {
      setContent("");
      setSelectedPlatforms(Object.keys(config).filter(p => config[p as SocialPlatform].enabled) as SocialPlatform[]);
      setImageUri(undefined);
    }
  }, [post, config]);

  const handleSave = () => {
    if (!content.trim()) {
      Alert.alert("Error", "Please enter post content");
      return;
    }

    if (selectedPlatforms.length === 0) {
      Alert.alert("Error", "Please select at least one platform");
      return;
    }

    onSave({
      content: content.trim(),
      platforms: selectedPlatforms,
      imageUri,
    });
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const togglePlatform = (platform: SocialPlatform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const availablePlatforms = Object.keys(config).filter(
    p => config[p as SocialPlatform].enabled
  ) as SocialPlatform[];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
          <Pressable onPress={onClose}>
            <Text className="text-blue-500 text-lg">Cancel</Text>
          </Pressable>
          <Text className="text-lg font-medium">
            {post ? "Edit Post" : "Create Post"}
          </Text>
          <Pressable onPress={handleSave}>
            <Text className="text-blue-500 text-lg font-medium">Save</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Content Input */}
          <Text className="text-gray-900 text-lg mb-2">Content</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="What's happening?"
            placeholderTextColor="#9CA3AF"
            className="bg-gray-100 text-gray-900 p-3 rounded-lg mb-4"
            multiline
            style={{ minHeight: 120 }}
            maxLength={280}
          />
          <Text className="text-gray-500 text-sm mb-4">
            {content.length}/280 characters
          </Text>

          {/* Image */}
          <View className="mb-4">
            <Text className="text-gray-900 text-lg mb-2">Image (Optional)</Text>
            {imageUri ? (
              <View className="relative">
                <Image
                  source={{ uri: imageUri }}
                  className="w-full h-48 rounded-lg"
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => setImageUri(undefined)}
                  className="absolute top-2 right-2 bg-red-600 rounded-full p-1"
                >
                  <Ionicons name="close" size={16} color="white" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={pickImage}
                className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 items-center"
              >
                <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                <Text className="text-gray-500 mt-2">Tap to add image</Text>
              </Pressable>
            )}
          </View>

          {/* Platform Selection */}
          <Text className="text-gray-900 text-lg mb-2">Platforms</Text>
          <View className="space-y-2">
            {availablePlatforms.map((platform) => (
              <Pressable
                key={platform}
                onPress={() => togglePlatform(platform)}
                className={`flex-row items-center p-3 rounded-lg border ${
                  selectedPlatforms.includes(platform)
                    ? "bg-blue-50 border-blue-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <Ionicons
                  name={selectedPlatforms.includes(platform) ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={selectedPlatforms.includes(platform) ? "#3B82F6" : "#9CA3AF"}
                />
                <Text className={`ml-3 capitalize ${
                  selectedPlatforms.includes(platform) ? "text-blue-700" : "text-gray-700"
                }`}>
                  {platform}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

interface ConfigModalProps {
  visible: boolean;
  config: any;
  onClose: () => void;
  onUpdateConfig: (platform: SocialPlatform, config: any) => void;
}

function ConfigModal({ visible, onClose }: ConfigModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
          <Pressable onPress={onClose}>
            <Text className="text-blue-500 text-lg">Done</Text>
          </Pressable>
          <Text className="text-lg font-medium">Social Media Settings</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView className="flex-1 p-4">
          <Text className="text-gray-500 text-center">
            Platform configuration coming soon...
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
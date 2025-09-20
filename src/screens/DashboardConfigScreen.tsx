import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStationStore } from "../state/stationStore";
import { useUserStore } from "../state/userStore";
import { DashboardSection } from "../types/station";

const DEFAULT_SECTIONS: DashboardSection[] = [
  {
    id: "local-news",
    name: "Local News",
    type: "news",
    enabled: true,
    order: 0,
    config: { category: "local", refreshInterval: 300 },
  },
  {
    id: "weather",
    name: "Weather",
    type: "weather",
    enabled: true,
    order: 1,
    config: { refreshInterval: 600 },
  },
  {
    id: "music-news",
    name: "Music News",
    type: "rss",
    enabled: false,
    order: 2,
    config: { 
      rssUrl: "https://feeds.feedburner.com/MusicNews",
      refreshInterval: 900 
    },
  },
  {
    id: "traffic",
    name: "Traffic Updates",
    type: "api",
    enabled: false,
    order: 3,
    config: { 
      apiEndpoint: "https://api.traffic.com/updates",
      refreshInterval: 300 
    },
  },
];

export default function DashboardConfigScreen() {
  const { stations, upsertStation } = useStationStore();
  const user = useUserStore((s) => s.user);
  
  const currentStation = stations.find(s => s.id === user.currentStationId) || stations[0];
  const [sections, setSections] = useState<DashboardSection[]>(
    currentStation?.dashboardSections || DEFAULT_SECTIONS
  );
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSection, setEditingSection] = useState<DashboardSection | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSaveChanges = () => {
    if (!currentStation) return;

    const updatedStation = {
      ...currentStation,
      dashboardSections: sections,
    };

    upsertStation(updatedStation);
    setHasChanges(false);
    Alert.alert("Success", "Dashboard configuration saved successfully!");
  };

  const handleAddSection = (newSection: Omit<DashboardSection, "id" | "order">) => {
    const section: DashboardSection = {
      ...newSection,
      id: `section-${Date.now()}`,
      order: sections.length,
    };
    
    setSections([...sections, section]);
    setHasChanges(true);
    setShowAddModal(false);
  };

  const handleUpdateSection = (id: string, updates: Partial<DashboardSection>) => {
    setSections(sections.map(section => 
      section.id === id ? { ...section, ...updates } : section
    ));
    setHasChanges(true);
  };

  const handleDeleteSection = (id: string) => {
    Alert.alert(
      "Delete Section",
      "Are you sure you want to delete this dashboard section?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setSections(sections.filter(s => s.id !== id));
            setHasChanges(true);
          },
        },
      ]
    );
  };

  const handleReorderSections = (fromIndex: number, toIndex: number) => {
    const newSections = [...sections];
    const [movedSection] = newSections.splice(fromIndex, 1);
    newSections.splice(toIndex, 0, movedSection);
    
    // Update order values
    const reorderedSections = newSections.map((section, index) => ({
      ...section,
      order: index,
    }));
    
    setSections(reorderedSections);
    setHasChanges(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-gray-900">Cards</Text>
          <View className="flex-row items-center space-x-2">
            {hasChanges && (
              <Pressable
                onPress={handleSaveChanges}
                className="bg-blue-600 px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-medium">Save Changes</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => setShowAddModal(true)}
              className="bg-green-600 px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-medium">Add Section</Text>
            </Pressable>
          </View>
        </View>
        
          <Text className="text-gray-600 mt-1">
          Manage dashboard cards for {currentStation?.name || "your station"}
        </Text>
      </View>

      {/* Sections List */}
      <ScrollView className="flex-1 px-4 py-4">
        {sections.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="grid-outline" size={64} color="#D1D5DB" />
            <Text className="text-gray-500 text-lg mt-4">No sections configured</Text>
            <Text className="text-gray-400 text-center mt-2">
              Add your first dashboard section to get started
            </Text>
          </View>
        ) : (
          <View className="space-y-4">
            {sections
              .sort((a, b) => a.order - b.order)
              .map((section, index) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  index={index}
                  totalSections={sections.length}
                  onUpdate={(updates) => handleUpdateSection(section.id, updates)}
                  onDelete={() => handleDeleteSection(section.id)}
                  onEdit={() => setEditingSection(section)}
                  onMoveUp={() => index > 0 && handleReorderSections(index, index - 1)}
                  onMoveDown={() => index < sections.length - 1 && handleReorderSections(index, index + 1)}
                />
              ))}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Section Modal */}
      <SectionModal
        visible={showAddModal || editingSection !== null}
        section={editingSection}
        onClose={() => {
          setShowAddModal(false);
          setEditingSection(null);
        }}
        onSave={(sectionData) => {
          if (editingSection) {
            handleUpdateSection(editingSection.id, sectionData);
            setEditingSection(null);
          } else {
            handleAddSection(sectionData);
          }
        }}
      />
    </SafeAreaView>
  );
}

interface SectionCardProps {
  section: DashboardSection;
  index: number;
  totalSections: number;
  onUpdate: (updates: Partial<DashboardSection>) => void;
  onDelete: () => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SectionCard({ 
  section, 
  index, 
  totalSections, 
  onUpdate, 
  onDelete, 
  onEdit, 
  onMoveUp, 
  onMoveDown 
}: SectionCardProps) {
  const getSectionIcon = (type: DashboardSection["type"]) => {
    switch (type) {
      case "news": return "newspaper-outline";
      case "weather": return "partly-sunny-outline";
      case "rss": return "rss-outline";
      case "api": return "cloud-outline";
      default: return "grid-outline";
    }
  };

  const getSectionColor = (type: DashboardSection["type"]) => {
    switch (type) {
      case "news": return "bg-blue-100 text-blue-700";
      case "weather": return "bg-yellow-100 text-yellow-700";
      case "rss": return "bg-green-100 text-green-700";
      case "api": return "bg-purple-100 text-purple-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <View className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          <View className={`p-2 rounded-lg mr-3 ${getSectionColor(section.type)}`}>
            <Ionicons name={getSectionIcon(section.type) as any} size={20} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-medium text-gray-900">{section.name}</Text>
            <Text className="text-sm text-gray-500 capitalize">{section.type}</Text>
          </View>
        </View>

        <View className="flex-row items-center space-x-2">
          <Switch
            value={section.enabled}
            onValueChange={(enabled) => onUpdate({ enabled })}
            trackColor={{ false: "#D1D5DB", true: "#3B82F6" }}
            thumbColor={section.enabled ? "#FFFFFF" : "#F3F4F6"}
          />
        </View>
      </View>

      {/* Configuration Preview */}
      <View className="bg-gray-50 rounded p-3 mb-3">
        <Text className="text-xs text-gray-500 mb-1">Configuration:</Text>
        {section.config.rssUrl && (
          <Text className="text-xs text-gray-600">RSS: {section.config.rssUrl}</Text>
        )}
        {section.config.apiEndpoint && (
          <Text className="text-xs text-gray-600">API: {section.config.apiEndpoint}</Text>
        )}
        {section.config.category && (
          <Text className="text-xs text-gray-600">Category: {section.config.category}</Text>
        )}
        {section.config.refreshInterval && (
          <Text className="text-xs text-gray-600">
            Refresh: {section.config.refreshInterval}s
          </Text>
        )}
      </View>

      {/* Actions */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center space-x-2">
          <Pressable
            onPress={onMoveUp}
            disabled={index === 0}
            className={`p-2 rounded ${index === 0 ? "bg-gray-100" : "bg-blue-100"}`}
          >
            <Ionicons 
              name="chevron-up" 
              size={16} 
              color={index === 0 ? "#9CA3AF" : "#3B82F6"} 
            />
          </Pressable>
          <Pressable
            onPress={onMoveDown}
            disabled={index === totalSections - 1}
            className={`p-2 rounded ${index === totalSections - 1 ? "bg-gray-100" : "bg-blue-100"}`}
          >
            <Ionicons 
              name="chevron-down" 
              size={16} 
              color={index === totalSections - 1 ? "#9CA3AF" : "#3B82F6"} 
            />
          </Pressable>
        </View>

        <View className="flex-row items-center space-x-2">
          <Pressable
            onPress={onEdit}
            className="bg-gray-100 px-3 py-1 rounded"
          >
            <Text className="text-gray-700 text-sm">Edit</Text>
          </Pressable>
          <Pressable
            onPress={onDelete}
            className="bg-red-100 px-3 py-1 rounded"
          >
            <Text className="text-red-700 text-sm">Delete</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

interface SectionModalProps {
  visible: boolean;
  section: DashboardSection | null;
  onClose: () => void;
  onSave: (sectionData: Omit<DashboardSection, "id" | "order">) => void;
}

function SectionModal({ visible, section, onClose, onSave }: SectionModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<DashboardSection["type"]>("news");
  const [enabled, setEnabled] = useState(true);
  const [rssUrl, setRssUrl] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [category, setCategory] = useState("");
  const [refreshInterval, setRefreshInterval] = useState("300");

  React.useEffect(() => {
    if (section) {
      setName(section.name);
      setType(section.type);
      setEnabled(section.enabled);
      setRssUrl(section.config.rssUrl || "");
      setApiEndpoint(section.config.apiEndpoint || "");
      setCategory(section.config.category || "");
      setRefreshInterval(section.config.refreshInterval?.toString() || "300");
    } else {
      setName("");
      setType("news");
      setEnabled(true);
      setRssUrl("");
      setApiEndpoint("");
      setCategory("");
      setRefreshInterval("300");
    }
  }, [section]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a section name");
      return;
    }

    const config: DashboardSection["config"] = {
      refreshInterval: parseInt(refreshInterval) || 300,
    };

    if (type === "rss" && rssUrl.trim()) {
      config.rssUrl = rssUrl.trim();
    }

    if (type === "api" && apiEndpoint.trim()) {
      config.apiEndpoint = apiEndpoint.trim();
    }

    if (category.trim()) {
      config.category = category.trim();
    }

    onSave({
      name: name.trim(),
      type,
      enabled,
      config,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
          <Pressable onPress={onClose}>
            <Text className="text-blue-500 text-lg">Cancel</Text>
          </Pressable>
          <Text className="text-lg font-medium">
            {section ? "Edit Section" : "Add Section"}
          </Text>
          <Pressable onPress={handleSave}>
            <Text className="text-blue-500 text-lg font-medium">Save</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Basic Info */}
          <View className="mb-6">
            <Text className="text-gray-900 text-lg mb-2">Section Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter section name..."
              placeholderTextColor="#9CA3AF"
              className="bg-gray-100 text-gray-900 p-3 rounded-lg"
            />
          </View>

          {/* Type Selection */}
          <View className="mb-6">
            <Text className="text-gray-900 text-lg mb-2">Section Type</Text>
            <View className="space-y-2">
              {[
                { value: "news", label: "News Feed", desc: "Local or category-based news" },
                { value: "weather", label: "Weather", desc: "Weather updates and forecasts" },
                { value: "rss", label: "RSS Feed", desc: "Custom RSS feed content" },
                { value: "api", label: "API Integration", desc: "Custom API data source" },
              ].map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setType(option.value as DashboardSection["type"])}
                  className={`p-3 rounded-lg border ${
                    type === option.value
                      ? "bg-blue-50 border-blue-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name={type === option.value ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={type === option.value ? "#3B82F6" : "#9CA3AF"}
                    />
                    <View className="ml-3 flex-1">
                      <Text className={`font-medium ${
                        type === option.value ? "text-blue-700" : "text-gray-700"
                      }`}>
                        {option.label}
                      </Text>
                      <Text className="text-gray-500 text-sm">{option.desc}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Type-specific Configuration */}
          {type === "rss" && (
            <View className="mb-6">
              <Text className="text-gray-900 text-lg mb-2">RSS URL</Text>
              <TextInput
                value={rssUrl}
                onChangeText={setRssUrl}
                placeholder="https://example.com/feed.xml"
                placeholderTextColor="#9CA3AF"
                className="bg-gray-100 text-gray-900 p-3 rounded-lg"
                keyboardType="url"
              />
            </View>
          )}

          {type === "api" && (
            <View className="mb-6">
              <Text className="text-gray-900 text-lg mb-2">API Endpoint</Text>
              <TextInput
                value={apiEndpoint}
                onChangeText={setApiEndpoint}
                placeholder="https://api.example.com/data"
                placeholderTextColor="#9CA3AF"
                className="bg-gray-100 text-gray-900 p-3 rounded-lg"
                keyboardType="url"
              />
            </View>
          )}

          {(type === "news" || type === "rss") && (
            <View className="mb-6">
              <Text className="text-gray-900 text-lg mb-2">Category (Optional)</Text>
              <TextInput
                value={category}
                onChangeText={setCategory}
                placeholder="e.g., local, sports, music"
                placeholderTextColor="#9CA3AF"
                className="bg-gray-100 text-gray-900 p-3 rounded-lg"
              />
            </View>
          )}

          {/* Refresh Interval */}
          <View className="mb-6">
            <Text className="text-gray-900 text-lg mb-2">Refresh Interval (seconds)</Text>
            <TextInput
              value={refreshInterval}
              onChangeText={setRefreshInterval}
              placeholder="300"
              placeholderTextColor="#9CA3AF"
              className="bg-gray-100 text-gray-900 p-3 rounded-lg"
              keyboardType="numeric"
            />
            <Text className="text-gray-500 text-sm mt-1">
              How often to refresh this section's content
            </Text>
          </View>

          {/* Enabled Toggle */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-gray-900 text-lg">Enabled</Text>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: "#D1D5DB", true: "#3B82F6" }}
                thumbColor={enabled ? "#FFFFFF" : "#F3F4F6"}
              />
            </View>
            <Text className="text-gray-500 text-sm mt-1">
              Whether this section appears on the dashboard
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
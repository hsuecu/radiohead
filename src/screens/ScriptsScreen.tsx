import React, { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, Modal, ScrollView, Alert, ActionSheetIOS, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useScriptStore, ScriptMeta, ScriptStatus } from "../state/scriptStore";
import { useSharedScriptsStore } from "../state/sharedScriptsStore";
import { timeAgo } from "../api/news";
import * as MailComposer from "expo-mail-composer";

interface ScriptCardProps {
  script: ScriptMeta;
  onOpen: () => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
  onStatusChange: (status: ScriptStatus) => void;
  getStatusColor: (status: ScriptStatus) => string;
  getStatusIcon: (status: ScriptStatus) => keyof typeof Ionicons.glyphMap;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
}

function ScriptCard({ 
  script, 
  onOpen, 
  onShare, 
  onRename, 
  onDelete, 
  onStatusChange,
  getStatusColor,
  getStatusIcon,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel
}: ScriptCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getReadTime = () => {
    const wordsPerMinute = 180;
    const totalWords = script.count * 50; // Estimate 50 words per item
    return Math.ceil(totalWords / wordsPerMinute);
  };

  return (
    <View className="bg-white rounded-xl border border-gray-200 p-4 mb-3 shadow-sm">
      {isRenaming ? (
        <View className="flex-row items-center">
          <TextInput
            value={renameValue}
            onChangeText={onRenameChange}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800"
            placeholder="Script name"
            placeholderTextColor="#9CA3AF"
          />
          <Pressable onPress={onRenameSubmit} className="ml-2 px-3 py-2 rounded-lg bg-blue-600">
            <Text className="text-white text-sm">Save</Text>
          </Pressable>
          <Pressable onPress={onRenameCancel} className="ml-2 px-3 py-2 rounded-lg bg-gray-100">
            <Text className="text-gray-800 text-sm">Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Header */}
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900 mb-1" numberOfLines={2}>
                {script.name}
              </Text>
              {script.description && (
                <Text className="text-sm text-gray-600 mb-2" numberOfLines={2}>
                  {script.description}
                </Text>
              )}
            </View>
            <Pressable 
              onLongPress={() => {
                const options = ['Draft', 'Ready', 'Broadcasted', 'Archived', 'Cancel'];
                const statuses: ScriptStatus[] = ['draft', 'ready', 'broadcasted', 'archived'];
                
                if (Platform.OS === 'ios') {
                  ActionSheetIOS.showActionSheetWithOptions(
                    {
                      options,
                      cancelButtonIndex: 4,
                      title: 'Change Status'
                    },
                    (buttonIndex) => {
                      if (buttonIndex < 4) {
                        onStatusChange(statuses[buttonIndex]);
                      }
                    }
                  );
                } else {
                  // For Android, we'll use a simple alert for now
                  Alert.alert(
                    'Change Status',
                    'Select new status:',
                    [
                      ...statuses.map((status, index) => ({
                        text: options[index],
                        onPress: () => onStatusChange(status)
                      })),
                      { text: 'Cancel' }
                    ]
                  );
                }
              }}
              className={`px-2 py-1 rounded-full flex-row items-center ml-3 ${getStatusColor(script.status)}`}
            >
              <Ionicons name={getStatusIcon(script.status)} size={12} color="currentColor" />
              <Text className="text-xs font-medium ml-1 capitalize">{script.status}</Text>
            </Pressable>
          </View>

          {/* Metadata */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center space-x-4">
              <View className="flex-row items-center">
                <Ionicons name="document-text-outline" size={14} color="#6B7280" />
                <Text className="text-xs text-gray-500 ml-1">{script.count} items</Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={14} color="#6B7280" />
                <Text className="text-xs text-gray-500 ml-1">~{getReadTime()}min read</Text>
              </View>
              {script.broadcastCount > 0 && (
                <View className="flex-row items-center">
                  <Ionicons name="radio-outline" size={14} color="#6B7280" />
                  <Text className="text-xs text-gray-500 ml-1">{script.broadcastCount}x aired</Text>
                </View>
              )}
            </View>
          </View>

          {/* Dates */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xs text-gray-400">
              Created {formatDate(script.createdAt)}
            </Text>
            <Text className="text-xs text-gray-400">
              Updated {timeAgo(script.updatedAt)}
            </Text>
          </View>

          {/* Actions */}
          <View className="flex-row items-center justify-between">
            <Pressable onPress={onOpen} className="px-4 py-2 rounded-lg bg-blue-600 flex-row items-center">
              <Ionicons name="play" size={14} color="white" />
              <Text className="text-white text-sm font-semibold ml-1">Open</Text>
            </Pressable>
            
            <View className="flex-row items-center space-x-2">
              <Pressable onPress={onShare} className="p-2 rounded-lg bg-gray-100">
                <Ionicons name="share-outline" size={16} color="#374151" />
              </Pressable>
              <Pressable onPress={onRename} className="p-2 rounded-lg bg-gray-100">
                <Ionicons name="create-outline" size={16} color="#374151" />
              </Pressable>
              <Pressable onPress={onDelete} className="p-2 rounded-lg bg-red-50">
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
              </Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

export default function ScriptsScreen() {
  const navigation = useNavigation<any>();
  const scriptsIndex = useScriptStore((s) => s.scriptsIndex);
  const scriptsMap = useScriptStore((s) => s.scriptsMap);
  const setCurrentScript = useScriptStore((s) => s.setCurrentScript);
  const createScript = useScriptStore((s) => s.createScript);
  const renameScript = useScriptStore((s) => s.renameScript);
  const deleteScript = useScriptStore((s) => s.deleteScript);
  const setActiveScriptSession = useScriptStore((s) => s.setActiveScriptSession);
  const updateScriptStatus = useScriptStore((s) => s.updateScriptStatus);
  const updateScriptDescription = useScriptStore((s) => s.updateScriptDescription);
  const markAsBroadcasted = useScriptStore((s) => s.markAsBroadcasted);
  
  const sharedScripts = useSharedScriptsStore((s) => s.sharedScripts);
  const acceptSharedScript = useSharedScriptsStore((s) => s.acceptSharedScript);
  const declineSharedScript = useSharedScriptsStore((s) => s.declineSharedScript);
  const exportScriptData = useSharedScriptsStore((s) => s.exportScriptData);
  const markAsShared = useSharedScriptsStore((s) => s.markAsShared);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showShare, setShowShare] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  const myScripts = useMemo(() => {
    const idx = [...(scriptsIndex || [])];
    idx.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return idx;
  }, [scriptsIndex]);

  const pendingSharedScripts = useMemo(() => {
    return sharedScripts.filter(s => s.status === "pending");
  }, [sharedScripts]);

  const openScript = (id: string) => {
    setCurrentScript(id);
    setActiveScriptSession(id);
    // Always navigate to Autocue consistently, via parent if available
    const parent = (navigation as any).getParent?.();
    requestAnimationFrame(() => {
      if (parent?.navigate) parent.navigate("Autocue");
      else navigation.navigate("Main", { screen: "Autocue" });
    });
  };

  const doCreate = () => {
    const id = createScript(newName.trim());
    if (newDescription.trim()) {
      updateScriptDescription(id, newDescription.trim());
    }
    setShowCreate(false);
    setNewName("");
    setNewDescription("");
    openScript(id);
  };

  const handleShare = async (script: ScriptMeta) => {
    if (!shareEmail.trim()) {
      Alert.alert("Error", "Please enter an email address");
      return;
    }

    try {
      const scriptItems = scriptsMap[script.id] || [];
      const exportData = exportScriptData(script, scriptItems, shareMessage.trim());
      
      const result = await MailComposer.composeAsync({
        recipients: [shareEmail.trim()],
        subject: `Script Shared: ${script.name}`,
        body: `Hi,\n\nI'm sharing a script with you: "${script.name}"\n\n${shareMessage.trim() ? `Message: ${shareMessage.trim()}\n\n` : ""}Script Data:\n${JSON.stringify(exportData, null, 2)}\n\nBest regards`,
        isHtml: false
      });

      if (result.status === MailComposer.MailComposerStatus.SENT) {
        markAsShared(script.id);
        Alert.alert("Success", "Script shared successfully!");
      }
      
      setShowShare(null);
      setShareEmail("");
      setShareMessage("");
    } catch (error) {
      Alert.alert("Error", "Failed to share script. Please try again.");
    }
  };

  const getStatusColor = (status: ScriptStatus) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-700";
      case "ready": return "bg-green-100 text-green-700";
      case "broadcasted": return "bg-blue-100 text-blue-700";
      case "archived": return "bg-orange-100 text-orange-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: ScriptStatus) => {
    switch (status) {
      case "draft": return "document-outline";
      case "ready": return "checkmark-circle-outline";
      case "broadcasted": return "radio-outline";
      case "archived": return "archive-outline";
      default: return "document-outline";
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView 
        className="flex-1" 
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View className="px-4 pt-4 pb-4">
          <Text className="text-gray-600 text-sm mb-3 text-center">Manage your scripts and collaborate with others</Text>
          <View className="flex-row justify-center">
            <Pressable onPress={() => setShowCreate(true)} className="px-6 py-3 rounded-full bg-blue-600 flex-row items-center shadow-sm">
              <Ionicons name="add" size={18} color="white" />
              <Text className="text-white text-sm font-semibold ml-2">New Script</Text>
            </Pressable>
          </View>
        </View>

        {/* Shared Scripts Section */}
        {pendingSharedScripts.length > 0 && (
          <View className="px-4 pb-4">
            <Text className="text-lg font-semibold text-gray-900 mb-3">Shared with You</Text>
            {pendingSharedScripts.map((shared) => (
              <View key={shared.id} className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900">{shared.name}</Text>
                    <Text className="text-sm text-gray-600 mt-1">From: {shared.sharedBy}</Text>
                    {shared.message && (
                      <Text className="text-sm text-gray-700 mt-2 italic">"{shared.message}"</Text>
                    )}
                    <Text className="text-xs text-gray-500 mt-2">{timeAgo(shared.sharedAt)}</Text>
                  </View>
                  <View className="flex-row ml-3">
                    <Pressable 
                      onPress={() => acceptSharedScript(shared.id)}
                      className="px-3 py-1.5 rounded-lg bg-green-600 mr-2"
                    >
                      <Text className="text-white text-xs font-semibold">Accept</Text>
                    </Pressable>
                    <Pressable 
                      onPress={() => declineSharedScript(shared.id)}
                      className="px-3 py-1.5 rounded-lg bg-gray-400"
                    >
                      <Text className="text-white text-xs font-semibold">Decline</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* My Scripts Section */}
        <View className="px-4 pb-4">
          <Text className="text-lg font-semibold text-gray-900 mb-4">My Scripts</Text>
          
          {myScripts.length === 0 ? (
            <View className="items-center justify-center py-20 bg-white rounded-xl border border-gray-200 mx-2">
              <Ionicons name="document-text-outline" size={72} color="#9CA3AF" />
              <Text className="text-gray-500 text-xl mt-6 mb-3 font-medium">No scripts yet</Text>
              <Text className="text-gray-400 text-center mb-8 px-6 leading-relaxed">
                Create your first script to get started with the autocue system. Scripts help you organize your content for smooth on-air delivery.
              </Text>
              <Pressable onPress={() => setShowCreate(true)} className="px-8 py-4 rounded-full bg-blue-600 shadow-sm">
                <Text className="text-white font-semibold text-base">Create Your First Script</Text>
              </Pressable>
            </View>
          ) : (
            <View className="space-y-1">
              {myScripts.map((script) => (
                <ScriptCard
                  key={script.id}
                  script={script}
                  onOpen={() => openScript(script.id)}
                  onShare={() => setShowShare(script.id)}
                  onRename={() => { setRenamingId(script.id); setRenameVal(script.name); }}
                  onDelete={() => setConfirmDeleteId(script.id)}
                  onStatusChange={(status) => updateScriptStatus(script.id, status)}
                  getStatusColor={getStatusColor}
                  getStatusIcon={getStatusIcon}
                  isRenaming={renamingId === script.id}
                  renameValue={renameVal}
                  onRenameChange={setRenameVal}
                  onRenameSubmit={() => {
                    if (renameVal.trim()) {
                      renameScript(script.id, renameVal.trim());
                      setRenamingId(null);
                      setRenameVal("");
                    }
                  }}
                  onRenameCancel={() => { setRenamingId(null); setRenameVal(""); }}
                />
              ))}
            </View>
          )}
        </View>
        
        {/* Bottom spacing for radio player and tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Create Script Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="px-4 py-3 border-b border-gray-200 flex-row items-center justify-between">
            <Pressable onPress={() => setShowCreate(false)}>
              <Text className="text-blue-600 text-lg">Cancel</Text>
            </Pressable>
            <Text className="text-lg font-semibold text-gray-900">New Script</Text>
            <Pressable onPress={doCreate} disabled={!newName.trim()}>
              <Text className={`text-lg font-semibold ${newName.trim() ? "text-blue-600" : "text-gray-300"}`}>Create</Text>
            </Pressable>
          </View>
          <View className="p-4 space-y-4">
            <View>
              <Text className="text-gray-900 mb-2 font-medium">Script Name</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                className="border border-gray-300 rounded-lg px-3 py-3 bg-white text-gray-800"
                placeholder="Enter script name..."
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View>
              <Text className="text-gray-900 mb-2 font-medium">Description (Optional)</Text>
              <TextInput
                value={newDescription}
                onChangeText={setNewDescription}
                className="border border-gray-300 rounded-lg px-3 py-3 bg-white text-gray-800"
                placeholder="Brief description of the script..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Share Script Modal */}
      <Modal visible={!!showShare} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowShare(null)}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="px-4 py-3 border-b border-gray-200 flex-row items-center justify-between">
            <Pressable onPress={() => setShowShare(null)}>
              <Text className="text-blue-600 text-lg">Cancel</Text>
            </Pressable>
            <Text className="text-lg font-semibold text-gray-900">Share Script</Text>
            <Pressable 
              onPress={() => {
                const script = myScripts.find(s => s.id === showShare);
                if (script) handleShare(script);
              }}
              disabled={!shareEmail.trim()}
            >
              <Text className={`text-lg font-semibold ${shareEmail.trim() ? "text-blue-600" : "text-gray-300"}`}>Send</Text>
            </Pressable>
          </View>
          <View className="p-4 space-y-4">
            <View>
              <Text className="text-gray-900 mb-2 font-medium">Recipient Email</Text>
              <TextInput
                value={shareEmail}
                onChangeText={setShareEmail}
                className="border border-gray-300 rounded-lg px-3 py-3 bg-white text-gray-800"
                placeholder="Enter email address..."
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View>
              <Text className="text-gray-900 mb-2 font-medium">Message (Optional)</Text>
              <TextInput
                value={shareMessage}
                onChangeText={setShareMessage}
                className="border border-gray-300 rounded-lg px-3 py-3 bg-white text-gray-800"
                placeholder="Add a personal message..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={!!confirmDeleteId} transparent animationType="fade" onRequestClose={() => setConfirmDeleteId(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View className="bg-white rounded-2xl p-6 w-full">
            <Text className="text-lg font-semibold text-gray-800 mb-2">Delete Script?</Text>
            <Text className="text-gray-600 mb-4">This action cannot be undone. The script and all its content will be permanently deleted.</Text>
            <View className="flex-row justify-end space-x-3">
              <Pressable onPress={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded-lg bg-gray-100">
                <Text className="text-gray-700 font-medium">Cancel</Text>
              </Pressable>
              <Pressable 
                onPress={() => { 
                  if (confirmDeleteId) deleteScript(confirmDeleteId); 
                  setConfirmDeleteId(null); 
                }} 
                className="px-4 py-2 rounded-lg bg-red-600"
              >
                <Text className="text-white font-medium">Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

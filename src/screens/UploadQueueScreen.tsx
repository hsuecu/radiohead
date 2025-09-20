import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useStorageQueue } from "../state/storageQueue";
import { useDeliveryQueue } from "../state/deliveryQueue";
import { useUserStore } from "../state/userStore";
import { getAuth } from "../api/storage/oauth";

export default function UploadQueueScreen() {
  const navigation = useNavigation();
  const stationId = useUserStore((s) => s.user.currentStationId) ?? "station-a";
  
  // Storage queue (cloud uploads)
  const storageJobs = useStorageQueue((s) => s.jobs);
  const storagePump = useStorageQueue((s) => s.pump);
  const pauseStorageJob = useStorageQueue((s) => s.pause);
  const resumeStorageJob = useStorageQueue((s) => s.resume);
  const removeStorageJob = useStorageQueue((s) => s.remove);
  const clearStorageCompleted = useStorageQueue((s) => s.clearCompleted);
  
  // Delivery queue (playout delivery)
  const allDeliveryItems = useDeliveryQueue((s) => s.items);
  const deliveryPump = useDeliveryQueue((s) => s.pump);
  const retryDelivery = useDeliveryQueue((s) => s.retry);
  const removeDelivery = useDeliveryQueue((s) => s.remove);
  const clearDeliveryCompleted = useDeliveryQueue((s) => s.clearCompleted);
  
  const deliveryItems = useMemo(() => 
    allDeliveryItems.filter(item => item.stationId === stationId), 
    [allDeliveryItems, stationId]
  );
  
  const [selectedTab, setSelectedTab] = useState<"storage" | "delivery">("storage");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; id?: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, boolean>>({});
  
  // Check connection status
  React.useEffect(() => {
    const checkConnections = async () => {
      const providers = ['dropbox', 'gdrive', 'onedrive'] as const;
      const status: Record<string, boolean> = {};
      for (const provider of providers) {
        const auth = await getAuth(provider);
        status[provider] = !!auth?.accessToken;
      }
      setConnectionStatus(status);
    };
    checkConnections();
  }, []);
  
  const activeStorageUploads = storageJobs.filter(job => 
    job.status === 'uploading' || job.status === 'pending'
  ).length;
  
  const activeDeliveryUploads = deliveryItems.filter(item => 
    item.status === 'uploading' || item.status === 'connecting' || item.status === 'verifying'
  ).length;
  
  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    
    try {
      switch (confirmAction.type) {
        case 'clearStorageCompleted':
          clearStorageCompleted();
          break;
        case 'clearDeliveryCompleted':
          clearDeliveryCompleted();
          break;
        case 'uploadAllStorage':
          await storagePump();
          break;
        case 'uploadAllDelivery':
          await deliveryPump();
          break;
        case 'removeStorageJob':
          if (confirmAction.id) removeStorageJob(confirmAction.id);
          break;
        case 'removeDeliveryJob':
          if (confirmAction.id) removeDelivery(confirmAction.id);
          break;
      }
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setShowConfirmModal(false);
      setConfirmAction(null);
    }
  };
  
  const showConfirm = (type: string, id?: string) => {
    setConfirmAction({ type, id });
    setShowConfirmModal(true);
  };
  
  const getConfirmMessage = () => {
    if (!confirmAction) return "";
    switch (confirmAction.type) {
      case 'clearStorageCompleted':
        return "Remove all completed cloud uploads from the queue?";
      case 'clearDeliveryCompleted':
        return "Remove all completed delivery jobs from the queue?";
      case 'uploadAllStorage':
        return `Start uploading all ${storageJobs.filter(j => j.status === 'pending').length} queued files to cloud storage now?`;
      case 'uploadAllDelivery':
        return `Start delivering all ${deliveryItems.filter(i => i.status === 'pending').length} queued files to playout now?`;
      case 'removeStorageJob':
        return "Remove this upload from the queue? This cannot be undone.";
      case 'removeDeliveryJob':
        return "Remove this delivery job from the queue? This cannot be undone.";
      default:
        return "Are you sure?";
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 py-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-800">Upload Queue</Text>
            <Text className="text-gray-600">Manage your file uploads and deliveries</Text>
          </View>
          <Pressable onPress={() => navigation.goBack()} className="px-3 py-2 bg-gray-200 rounded-full">
            <Text className="text-gray-700">Close</Text>
          </Pressable>
        </View>
        
        {/* Tab Selector */}
        <View className="flex-row bg-gray-100 rounded-lg p-1">
          <Pressable 
            onPress={() => setSelectedTab("storage")} 
            className={`flex-1 py-2 px-3 rounded-md ${selectedTab === "storage" ? "bg-white shadow-sm" : ""}`}
          >
            <Text className={`text-center font-medium ${selectedTab === "storage" ? "text-blue-600" : "text-gray-600"}`}>
              Cloud Storage ({storageJobs.length})
            </Text>
          </Pressable>
          <Pressable 
            onPress={() => setSelectedTab("delivery")} 
            className={`flex-1 py-2 px-3 rounded-md ${selectedTab === "delivery" ? "bg-white shadow-sm" : ""}`}
          >
            <Text className={`text-center font-medium ${selectedTab === "delivery" ? "text-blue-600" : "text-gray-600"}`}>
              Playout Delivery ({deliveryItems.length})
            </Text>
          </Pressable>
        </View>
      </View>
      
      <ScrollView className="flex-1">
        {selectedTab === "storage" ? (
          <View className="p-6">
            {/* Storage Queue Status */}
            <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-semibold text-gray-800">Cloud Storage Queue</Text>
                <View className="flex-row items-center">
                  <View className={`w-2 h-2 rounded-full mr-2 ${activeStorageUploads > 0 ? 'bg-blue-500' : 'bg-gray-400'}`} />
                  <Text className="text-sm text-gray-600">
                    {activeStorageUploads > 0 ? `${activeStorageUploads} active` : 'Idle'}
                  </Text>
                </View>
              </View>
              
              {/* Connection Status */}
              <View className="flex-row items-center gap-4 mb-3">
                {Object.entries(connectionStatus).map(([provider, connected]) => (
                  <View key={provider} className="flex-row items-center">
                    <View className={`w-2 h-2 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <Text className="text-xs text-gray-600 capitalize">{provider}</Text>
                  </View>
                ))}
                <Pressable onPress={() => (navigation as any).navigate('StorageSettings')} className="ml-auto px-2 py-1 bg-blue-100 rounded">
                  <Text className="text-blue-700 text-xs">Settings</Text>
                </Pressable>
              </View>
              
              {/* Action Buttons */}
              <View className="flex-row gap-2">
                <Pressable 
                  onPress={() => showConfirm('uploadAllStorage')} 
                  disabled={storageJobs.filter(j => j.status === 'pending').length === 0}
                  className={`flex-1 py-2 px-3 rounded-lg ${
                    storageJobs.filter(j => j.status === 'pending').length > 0 ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <Text className="text-white text-center font-medium">Upload All</Text>
                </Pressable>
                <Pressable 
                  onPress={() => showConfirm('clearStorageCompleted')} 
                  disabled={storageJobs.filter(j => j.status === 'complete').length === 0}
                  className={`flex-1 py-2 px-3 rounded-lg ${
                    storageJobs.filter(j => j.status === 'complete').length > 0 ? 'bg-gray-600' : 'bg-gray-300'
                  }`}
                >
                  <Text className="text-white text-center font-medium">Clear Completed</Text>
                </Pressable>
              </View>
            </View>
            
            {/* Storage Jobs List */}
            {storageJobs.length === 0 ? (
              <View className="bg-white rounded-lg p-8 shadow-sm">
                <View className="items-center">
                  <Ionicons name="cloud-upload-outline" size={64} color="#9CA3AF" />
                  <Text className="text-gray-500 text-lg mt-4">No cloud uploads</Text>
                  <Text className="text-gray-400 text-center mt-2">
                    Files will appear here when you queue them for cloud storage
                  </Text>
                </View>
              </View>
            ) : (
              <View className="space-y-3">
                {storageJobs.map((job) => (
                  <View key={job.id} className="bg-white rounded-lg p-4 shadow-sm">
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-1">
                        <Text className="font-medium text-gray-800" numberOfLines={1}>
                          {job.remotePath.split('/').pop() || job.remotePath}
                        </Text>
                        <Text className="text-sm text-gray-500 mt-1">
                          {job.provider.toUpperCase()} • {job.status.replace('_', ' ').toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-row gap-2">
                        {job.status === 'pending' && (
                          <Pressable onPress={() => pauseStorageJob(job.id)} className="px-3 py-1 bg-yellow-500 rounded">
                            <Text className="text-white text-xs">Pause</Text>
                          </Pressable>
                        )}
                        {job.status === 'paused' && (
                          <Pressable onPress={() => resumeStorageJob(job.id)} className="px-3 py-1 bg-green-500 rounded">
                            <Text className="text-white text-xs">Resume</Text>
                          </Pressable>
                        )}
                        {job.status === 'failed' && (
                          <Pressable onPress={() => resumeStorageJob(job.id)} className="px-3 py-1 bg-blue-500 rounded">
                            <Text className="text-white text-xs">Retry</Text>
                          </Pressable>
                        )}
                        <Pressable onPress={() => showConfirm('removeStorageJob', job.id)} className="px-3 py-1 bg-red-500 rounded">
                          <Text className="text-white text-xs">Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                    
                    {job.error && (
                      <View className="mb-3 p-3 bg-red-50 rounded-lg border border-red-200">
                        <Text className="text-red-700 text-sm">{job.error}</Text>
                      </View>
                    )}
                    
                    <View className="h-2 bg-gray-200 rounded-full">
                      <View 
                        style={{ width: `${Math.round((job.progress || 0) * 100)}%` }} 
                        className={`h-2 rounded-full ${
                          job.status === 'complete' ? 'bg-green-500' : 
                          job.status === 'failed' ? 'bg-red-500' : 
                          job.status === 'paused' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`} 
                      />
                    </View>
                    <View className="flex-row justify-between mt-2">
                      <Text className="text-xs text-gray-500">
                        {Math.round((job.progress || 0) * 100)}% complete
                      </Text>
                      <Text className="text-xs text-gray-500">
                        {job.retries > 0 ? `${job.retries} retries` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View className="p-6">
            {/* Delivery Queue Status */}
            <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-semibold text-gray-800">Playout Delivery Queue</Text>
                <View className="flex-row items-center">
                  <View className={`w-2 h-2 rounded-full mr-2 ${activeDeliveryUploads > 0 ? 'bg-blue-500' : 'bg-gray-400'}`} />
                  <Text className="text-sm text-gray-600">
                    {activeDeliveryUploads > 0 ? `${activeDeliveryUploads} active` : 'Idle'}
                  </Text>
                </View>
              </View>
              
              {/* Action Buttons */}
              <View className="flex-row gap-2">
                <Pressable 
                  onPress={() => showConfirm('uploadAllDelivery')} 
                  disabled={deliveryItems.filter(i => i.status === 'pending').length === 0}
                  className={`flex-1 py-2 px-3 rounded-lg ${
                    deliveryItems.filter(i => i.status === 'pending').length > 0 ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <Text className="text-white text-center font-medium">Deliver All</Text>
                </Pressable>
                <Pressable 
                  onPress={() => showConfirm('clearDeliveryCompleted')} 
                  disabled={deliveryItems.filter(i => i.status === 'complete').length === 0}
                  className={`flex-1 py-2 px-3 rounded-lg ${
                    deliveryItems.filter(i => i.status === 'complete').length > 0 ? 'bg-gray-600' : 'bg-gray-300'
                  }`}
                >
                  <Text className="text-white text-center font-medium">Clear Completed</Text>
                </Pressable>
              </View>
            </View>
            
            {/* Delivery Jobs List */}
            {deliveryItems.length === 0 ? (
              <View className="bg-white rounded-lg p-8 shadow-sm">
                <View className="items-center">
                  <Ionicons name="radio-outline" size={64} color="#9CA3AF" />
                  <Text className="text-gray-500 text-lg mt-4">No playout deliveries</Text>
                  <Text className="text-gray-400 text-center mt-2">
                    Files will appear here when you deliver them to playout systems
                  </Text>
                </View>
              </View>
            ) : (
              <View className="space-y-3">
                {deliveryItems.map((item) => (
                  <View key={item.id} className="bg-white rounded-lg p-4 shadow-sm">
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-1">
                        <Text className="font-medium text-gray-800" numberOfLines={1}>
                          {item.remoteRelPath.split('/').pop() || item.remoteRelPath}
                        </Text>
                        <Text className="text-sm text-gray-500 mt-1">
                          {item.profile.delivery.method?.toUpperCase() || 'LOCAL'} • {item.status.replace('_', ' ').toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-row gap-2">
                        {item.status === 'failed' && (
                          <Pressable onPress={() => retryDelivery(item.id)} className="px-3 py-1 bg-blue-500 rounded">
                            <Text className="text-white text-xs">Retry</Text>
                          </Pressable>
                        )}
                        <Pressable onPress={() => showConfirm('removeDeliveryJob', item.id)} className="px-3 py-1 bg-red-500 rounded">
                          <Text className="text-white text-xs">Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                    
                    {item.error && (
                      <View className="mb-3 p-3 bg-red-50 rounded-lg border border-red-200">
                        <Text className="text-red-700 text-sm">{item.error}</Text>
                      </View>
                    )}
                    
                    <View className="h-2 bg-gray-200 rounded-full">
                      <View 
                        style={{ width: `${Math.round(item.progress * 100)}%` }} 
                        className={`h-2 rounded-full ${
                          item.status === 'complete' ? 'bg-green-500' : 
                          item.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                        }`} 
                      />
                    </View>
                    <View className="flex-row justify-between mt-2">
                      <Text className="text-xs text-gray-500">
                        {Math.round(item.progress * 100)}% complete
                      </Text>
                      <Text className="text-xs text-gray-500">
                        {item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      
      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade" onRequestClose={() => setShowConfirmModal(false)}>
        <View className="flex-1 items-center justify-center bg-black bg-opacity-50">
          <View className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-blue-100 items-center justify-center mb-3">
                <Ionicons name="help-circle" size={32} color="#3B82F6" />
              </View>
              <Text className="text-xl font-bold text-gray-900 mb-2">Confirm Action</Text>
              <Text className="text-gray-600 text-center">
                {getConfirmMessage()}
              </Text>
            </View>
            <View className="flex-row gap-3">
              <Pressable 
                onPress={() => setShowConfirmModal(false)} 
                className="flex-1 bg-gray-200 rounded-lg p-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-center text-gray-700 font-medium">Cancel</Text>
              </Pressable>
              <Pressable 
                onPress={handleConfirmAction} 
                className="flex-1 bg-blue-600 rounded-lg p-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-center text-white font-medium">Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
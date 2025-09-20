import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../api/storage/oauth';
import { DropboxFolder } from '../types/storage';
import { DropboxErrorHandler } from '../utils/dropboxErrors';
import { notificationManager } from '../utils/notifications';

interface FolderPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectFolder: (folderPath: string) => void;
  initialPath?: string;
  title?: string;
  allowCreateFolder?: boolean;
}

export default function FolderPicker({
  visible,
  onClose,
  onSelectFolder,
  initialPath = '',
  title = 'Select Folder',
  allowCreateFolder = true
}: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [folders, setFolders] = useState<DropboxFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      loadFolders(currentPath);
      updateBreadcrumbs(currentPath);
    }
  }, [visible, currentPath]);

  const updateBreadcrumbs = (path: string) => {
    if (!path || path === '/') {
      setBreadcrumbs(['Home']);
      return;
    }
    const parts = path.split('/').filter(Boolean);
    setBreadcrumbs(['Home', ...parts]);
  };

  const loadFolders = async (path: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const auth = await getAuth('dropbox');
      if (!auth?.accessToken) {
        throw new Error('Not connected to Dropbox');
      }

      const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: path || '',
          recursive: false,
          include_media_info: false,
          include_deleted: false,
          include_has_explicit_shared_members: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { status: response.status, data: errorData };
      }

      const data = await response.json();
      const folderItems: DropboxFolder[] = data.entries
        .filter((item: any) => item['.tag'] === 'folder')
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          path: item.path_lower,
          isFolder: true,
          canWrite: true, // Assume writable for now
        }))
        .sort((a: DropboxFolder, b: DropboxFolder) => a.name.localeCompare(b.name));

      setFolders(folderItems);
    } catch (err: any) {
      const dropboxError = DropboxErrorHandler.categorizeError(err);
      setError(dropboxError.userMessage);
      notificationManager.error('Folder Loading Failed', dropboxError.userMessage);
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folderPath: string) => {
    setCurrentPath(folderPath);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === 0) {
      setCurrentPath('');
      return;
    }
    
    const pathParts = breadcrumbs.slice(1, index + 1);
    const newPath = '/' + pathParts.join('/');
    setCurrentPath(newPath);
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    setLoading(true);
    try {
      const auth = await getAuth('dropbox');
      if (!auth?.accessToken) {
        throw new Error('Not connected to Dropbox');
      }

      const newFolderPath = currentPath ? `${currentPath}/${newFolderName.trim()}` : `/${newFolderName.trim()}`;

      const response = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: newFolderPath,
          autorename: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { status: response.status, data: errorData };
      }

      setNewFolderName('');
      setShowCreateFolder(false);
      await loadFolders(currentPath);
      notificationManager.success('Folder Created', `Created folder "${newFolderName.trim()}"`);
    } catch (err: any) {
      const dropboxError = DropboxErrorHandler.categorizeError(err);
      notificationManager.error('Folder Creation Failed', dropboxError.userMessage);
    } finally {
      setLoading(false);
    }
  };

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectFolder = () => {
    onSelectFolder(currentPath);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="bg-white border-b border-gray-200 px-6 py-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xl font-bold text-gray-900">{title}</Text>
            <Pressable onPress={onClose} className="px-3 py-2 bg-gray-200 rounded-full">
              <Text className="text-gray-700">Cancel</Text>
            </Pressable>
          </View>

          {/* Breadcrumbs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            <View className="flex-row items-center">
              {breadcrumbs.map((crumb, index) => (
                <View key={index} className="flex-row items-center">
                  <Pressable
                    onPress={() => navigateToBreadcrumb(index)}
                    className="px-2 py-1 rounded bg-blue-100"
                  >
                    <Text className="text-blue-700 text-sm">{crumb}</Text>
                  </Pressable>
                  {index < breadcrumbs.length - 1 && (
                    <Ionicons name="chevron-forward" size={16} color="#6B7280" className="mx-1" />
                  )}
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Search */}
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search folders..."
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
          />
        </View>

        {/* Content */}
        <View className="flex-1">
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-gray-600 mt-2">Loading folders...</Text>
            </View>
          ) : error ? (
            <View className="flex-1 items-center justify-center px-6">
              <Ionicons name="alert-circle" size={64} color="#EF4444" />
              <Text className="text-red-600 text-lg font-medium mt-4">Error Loading Folders</Text>
              <Text className="text-gray-600 text-center mt-2">{error}</Text>
              <Pressable
                onPress={() => loadFolders(currentPath)}
                className="mt-4 px-4 py-2 bg-blue-600 rounded-lg"
              >
                <Text className="text-white font-medium">Try Again</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView className="flex-1">
              {/* Current folder selection */}
              <View className="bg-blue-50 border-b border-blue-200 px-6 py-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-blue-800 font-medium">Current Selection</Text>
                    <Text className="text-blue-600 text-sm">
                      {currentPath || '/'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleSelectFolder}
                    className="px-4 py-2 bg-blue-600 rounded-lg"
                  >
                    <Text className="text-white font-medium">Select This Folder</Text>
                  </Pressable>
                </View>
              </View>

              {/* Folders list */}
              <View className="px-6 py-4">
                {filteredFolders.length === 0 ? (
                  <View className="items-center py-8">
                    <Ionicons name="folder-outline" size={64} color="#9CA3AF" />
                    <Text className="text-gray-500 text-lg mt-4">
                      {searchQuery ? 'No folders match your search' : 'No folders found'}
                    </Text>
                    {allowCreateFolder && !searchQuery && (
                      <Pressable
                        onPress={() => setShowCreateFolder(true)}
                        className="mt-4 px-4 py-2 bg-green-600 rounded-lg"
                      >
                        <Text className="text-white font-medium">Create First Folder</Text>
                      </Pressable>
                    )}
                  </View>
                ) : (
                  <View className="space-y-2">
                    {filteredFolders.map((folder) => (
                      <Pressable
                        key={folder.id}
                        onPress={() => navigateToFolder(folder.path)}
                        className="flex-row items-center p-3 rounded-lg border border-gray-200 bg-gray-50"
                      >
                        <Ionicons name="folder" size={24} color="#3B82F6" />
                        <View className="flex-1 ml-3">
                          <Text className="text-gray-900 font-medium">{folder.name}</Text>
                          <Text className="text-gray-500 text-sm">{folder.path}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Footer */}
        <View className="bg-white border-t border-gray-200 px-6 py-4">
          <View className="flex-row gap-3">
            {allowCreateFolder && (
              <Pressable
                onPress={() => setShowCreateFolder(true)}
                className="flex-1 px-4 py-3 bg-green-600 rounded-lg"
              >
                <Text className="text-white text-center font-medium">Create Folder</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleSelectFolder}
              className="flex-1 px-4 py-3 bg-blue-600 rounded-lg"
            >
              <Text className="text-white text-center font-medium">Select Current</Text>
            </Pressable>
          </View>
        </View>

        {/* Create Folder Modal */}
        <Modal visible={showCreateFolder} transparent animationType="fade">
          <View className="flex-1 items-center justify-center bg-black bg-opacity-50">
            <View className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
              <Text className="text-xl font-bold text-gray-900 mb-4">Create New Folder</Text>
              <TextInput
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="Folder name"
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-4"
                autoFocus
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setShowCreateFolder(false);
                    setNewFolderName('');
                  }}
                  className="flex-1 bg-gray-200 rounded-lg p-3"
                >
                  <Text className="text-center text-gray-700 font-medium">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={createFolder}
                  disabled={!newFolderName.trim() || loading}
                  className={`flex-1 rounded-lg p-3 ${
                    newFolderName.trim() && !loading ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <Text className="text-center text-white font-medium">
                    {loading ? 'Creating...' : 'Create'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}
import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useChatStore, ChatRoom, ChatMessage, ChatType } from "../state/chatStore";
import { useUserStore } from "../state/userStore";
import * as ImagePicker from "expo-image-picker";

export default function ChatScreen() {
  const {
    rooms,
    messages,

    currentUserId,
    initializeDatabase,
    createRoom,
    sendMessage,
    getMessages,
    markMessagesAsRead,
    blockRoom,
    unblockRoom,
    setTyping,
  } = useChatStore();

  const user = useUserStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<ChatType>("internal");
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize database and set current user
  useEffect(() => {
    initializeDatabase();
    // Set current user ID from user store
    if (user.id && !currentUserId) {
      // In a real app, you'd set this through a proper action
      console.log("Setting current user:", user.id);
    }
  }, [initializeDatabase, user.id, currentUserId]);

  // Load messages for selected room
  useEffect(() => {
    if (selectedRoom) {
      loadRoomMessages(selectedRoom.id);
      markMessagesAsRead(selectedRoom.id);
    }
  }, [selectedRoom]);

  const loadRoomMessages = async (roomId: string) => {
    try {
      await getMessages(roomId);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedRoom || !newMessage.trim()) return;

    try {
      await sendMessage(selectedRoom.id, newMessage.trim());
      setNewMessage("");
      setIsTyping(false);
      
      // Clear typing indicator
      if (currentUserId) {
        setTyping(selectedRoom.id, currentUserId, false);
      }
      
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("Failed to send message:", error);
      Alert.alert("Error", "Failed to send message");
    }
  };

  const handleCreateRoom = async () => {
    if (!newChatName.trim()) return;

    try {
      const roomId = await createRoom(
        newChatName.trim(),
        activeTab,
        [currentUserId || user.id] // Add current user as participant
      );
      
      setNewChatName("");
      setShowNewChatModal(false);
      
      // Select the new room
      const newRoom = rooms.find(r => r.id === roomId);
      if (newRoom) {
        setSelectedRoom(newRoom);
      }
    } catch (error) {
      console.error("Failed to create room:", error);
      Alert.alert("Error", "Failed to create chat room");
    }
  };

  const handleTyping = (text: string) => {
    setNewMessage(text);
    
    if (!selectedRoom || !currentUserId) return;
    
    // Set typing indicator
    if (text.trim() && !isTyping) {
      setIsTyping(true);
      setTyping(selectedRoom.id, currentUserId, true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to clear typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (currentUserId) {
        setTyping(selectedRoom.id, currentUserId, false);
      }
    }, 2000);
  };

  const handleBlockRoom = async (room: ChatRoom) => {
    Alert.alert(
      "Block Chat",
      `Are you sure you want to block "${room.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              await blockRoom(room.id);
              if (selectedRoom?.id === room.id) {
                setSelectedRoom(null);
              }
            } catch (error) {
              Alert.alert("Error", "Failed to block chat");
            }
          },
        },
      ]
    );
  };

  const handleUnblockRoom = async (room: ChatRoom) => {
    try {
      await unblockRoom(room.id);
    } catch (error) {
      Alert.alert("Error", "Failed to unblock chat");
    }
  };

  const handleAttachFile = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && selectedRoom) {
      const asset = result.assets[0];
      try {
        await sendMessage(
          selectedRoom.id,
          `Shared ${asset.type}: ${asset.fileName || "file"}`,
          "image",
          asset.uri
        );
      } catch (error) {
        Alert.alert("Error", "Failed to send file");
      }
    }
  };

  const filteredRooms = rooms.filter(room => room.type === activeTab);
  const roomMessages = selectedRoom ? messages[selectedRoom.id] || [] : [];

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-white border-b border-gray-200">
        <View className="px-4 py-3">
          <Text className="text-xl font-bold text-gray-900">Chat</Text>
        </View>
        
        {/* Tab Selector */}
        <View className="flex-row">
          <Pressable
            onPress={() => setActiveTab("internal")}
            className={`flex-1 py-3 items-center border-b-2 ${
              activeTab === "internal" ? "border-blue-500" : "border-transparent"
            }`}
          >
            <Text className={`font-medium ${
              activeTab === "internal" ? "text-blue-600" : "text-gray-500"
            }`}>
              Internal
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("external")}
            className={`flex-1 py-3 items-center border-b-2 ${
              activeTab === "external" ? "border-blue-500" : "border-transparent"
            }`}
          >
            <Text className={`font-medium ${
              activeTab === "external" ? "text-blue-600" : "text-gray-500"
            }`}>
              External
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-1 flex-row">
        {/* Chat List */}
        <View className="w-80 bg-white border-r border-gray-200">
          <View className="p-4 border-b border-gray-200">
            <Pressable
              onPress={() => setShowNewChatModal(true)}
              className="bg-blue-600 py-2 px-4 rounded-lg items-center"
            >
              <Text className="text-white font-medium">New Chat</Text>
            </Pressable>
          </View>
          
          <ScrollView className="flex-1">
            {filteredRooms.map((room) => (
              <ChatRoomItem
                key={room.id}
                room={room}
                isSelected={selectedRoom?.id === room.id}
                onSelect={() => setSelectedRoom(room)}
                onBlock={() => handleBlockRoom(room)}
                onUnblock={() => handleUnblockRoom(room)}
              />
            ))}
            
            {filteredRooms.length === 0 && (
              <View className="p-4 items-center">
                <Ionicons name="chatbubbles-outline" size={48} color="#9CA3AF" />
                <Text className="text-gray-500 mt-2 text-center">
                  No {activeTab} chats yet
                </Text>
                <Text className="text-gray-400 text-sm text-center mt-1">
                  Create your first chat to get started
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Chat Messages */}
        <View className="flex-1">
          {selectedRoom ? (
            <>
              {/* Chat Header */}
              <View className="bg-white border-b border-gray-200 px-4 py-3">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-lg font-medium text-gray-900">
                      {selectedRoom.name}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      {selectedRoom.participants.length} participants
                    </Text>
                  </View>
                  
                  <View className="flex-row items-center space-x-2">
                    <Pressable className="p-2 rounded-full bg-gray-100">
                      <Ionicons name="videocam-outline" size={20} color="#6B7280" />
                    </Pressable>
                    <Pressable className="p-2 rounded-full bg-gray-100">
                      <Ionicons name="call-outline" size={20} color="#6B7280" />
                    </Pressable>
                    <Pressable className="p-2 rounded-full bg-gray-100">
                      <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Messages */}
              <ScrollView
                ref={scrollViewRef}
                className="flex-1 px-4 py-2"
                showsVerticalScrollIndicator={false}
              >
                {roomMessages.map((message) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    isFromMe={message.senderId === (currentUserId || user.id)}
                  />
                ))}
                
                {roomMessages.length === 0 && (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons name="chatbubble-outline" size={64} color="#D1D5DB" />
                    <Text className="text-gray-400 mt-4">No messages yet</Text>
                    <Text className="text-gray-400 text-sm">Start the conversation!</Text>
                  </View>
                )}
              </ScrollView>

              {/* Message Input */}
              <View className="bg-white border-t border-gray-200 px-4 py-3">
                <View className="flex-row items-end space-x-3">
                  <Pressable
                    onPress={handleAttachFile}
                    className="p-2 rounded-full bg-gray-100"
                  >
                    <Ionicons name="attach" size={20} color="#6B7280" />
                  </Pressable>
                  
                  <View className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 max-h-24">
                    <TextInput
                      value={newMessage}
                      onChangeText={handleTyping}
                      placeholder="Type a message..."
                      placeholderTextColor="#9CA3AF"
                      className="text-gray-900"
                      multiline
                      maxLength={1000}
                    />
                  </View>
                  
                  <Pressable
                    onPress={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className={`p-2 rounded-full ${
                      newMessage.trim() ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <Ionicons 
                      name="send" 
                      size={20} 
                      color={newMessage.trim() ? "white" : "#9CA3AF"} 
                    />
                  </Pressable>
                </View>
              </View>
            </>
          ) : (
            <View className="flex-1 items-center justify-center bg-gray-50">
              <Ionicons name="chatbubbles-outline" size={80} color="#D1D5DB" />
              <Text className="text-gray-500 text-lg mt-4">Select a chat to start messaging</Text>
              <Text className="text-gray-400 text-center mt-2 px-8">
                Choose a conversation from the list or create a new one
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* New Chat Modal */}
      <Modal
        visible={showNewChatModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
            <Pressable onPress={() => setShowNewChatModal(false)}>
              <Text className="text-blue-500 text-lg">Cancel</Text>
            </Pressable>
            <Text className="text-lg font-medium">New {activeTab} Chat</Text>
            <Pressable onPress={handleCreateRoom}>
              <Text className="text-blue-500 text-lg font-medium">Create</Text>
            </Pressable>
          </View>

          <View className="flex-1 p-4">
            <Text className="text-gray-900 text-lg mb-2">Chat Name</Text>
            <TextInput
              value={newChatName}
              onChangeText={setNewChatName}
              placeholder="Enter chat name..."
              placeholderTextColor="#9CA3AF"
              className="bg-gray-100 text-gray-900 p-3 rounded-lg"
            />
            
            <Text className="text-gray-500 text-sm mt-2">
              Create a new {activeTab} chat room for your team
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

interface ChatRoomItemProps {
  room: ChatRoom;
  isSelected: boolean;
  onSelect: () => void;
  onBlock: () => void;
  onUnblock: () => void;
}

function ChatRoomItem({ room, isSelected, onSelect, onBlock, onUnblock }: ChatRoomItemProps) {
  const lastMessageTime = room.lastMessage 
    ? new Date(room.lastMessage.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <Pressable
      onPress={onSelect}
      className={`p-4 border-b border-gray-100 ${isSelected ? "bg-blue-50" : ""}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className={`font-medium ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
              {room.name}
            </Text>
            {room.isBlocked && (
              <Ionicons name="ban" size={16} color="#EF4444" className="ml-2" />
            )}
          </View>
          
          {room.lastMessage && (
            <Text className="text-gray-500 text-sm mt-1" numberOfLines={1}>
              {room.lastMessage.content}
            </Text>
          )}
        </View>
        
        <View className="items-end">
          {lastMessageTime && (
            <Text className="text-gray-400 text-xs">{lastMessageTime}</Text>
          )}
          {room.unreadCount > 0 && (
            <View className="bg-blue-600 rounded-full w-5 h-5 items-center justify-center mt-1">
              <Text className="text-white text-xs font-bold">
                {room.unreadCount > 9 ? "9+" : room.unreadCount}
              </Text>
            </View>
          )}
          
          <Pressable
            onPress={room.isBlocked ? onUnblock : onBlock}
            className="mt-2"
          >
            <Ionicons 
              name={room.isBlocked ? "checkmark-circle" : "ban"} 
              size={16} 
              color={room.isBlocked ? "#10B981" : "#EF4444"} 
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

interface MessageItemProps {
  message: ChatMessage;
  isFromMe: boolean;
}

function MessageItem({ message, isFromMe }: MessageItemProps) {
  const messageTime = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: "2-digit", 
    minute: "2-digit" 
  });

  return (
    <View className={`mb-3 ${isFromMe ? "items-end" : "items-start"}`}>
      {!isFromMe && (
        <Text className="text-gray-500 text-xs mb-1 ml-3">
          {message.senderName}
        </Text>
      )}
      
      <View
        className={`max-w-xs px-3 py-2 rounded-2xl ${
          isFromMe
            ? "bg-blue-600 rounded-br-md"
            : "bg-white rounded-bl-md shadow-sm border border-gray-200"
        }`}
      >
        {message.type === "image" && message.fileUri && (
          <View className="mb-2">
            <Text className={`text-sm ${isFromMe ? "text-blue-100" : "text-gray-600"}`}>
              📷 Image
            </Text>
          </View>
        )}
        
        <Text className={`text-sm ${isFromMe ? "text-white" : "text-gray-900"}`}>
          {message.content}
        </Text>
        
        <View className="flex-row items-center justify-end mt-1">
          <Text className={`text-xs ${isFromMe ? "text-blue-100" : "text-gray-500"}`}>
            {messageTime}
          </Text>
          {isFromMe && (
            <View className="ml-1">
              {message.isRead ? (
                <View className="flex-row">
                  <Ionicons name="checkmark" size={12} color="#DBEAFE" />
                  <Ionicons name="checkmark" size={12} color="#DBEAFE" style={{ marginLeft: -4 }} />
                </View>
              ) : message.isDelivered ? (
                <View className="flex-row">
                  <Ionicons name="checkmark" size={12} color="#DBEAFE" />
                  <Ionicons name="checkmark" size={12} color="#DBEAFE" style={{ marginLeft: -4 }} />
                </View>
              ) : (
                <Ionicons name="checkmark" size={12} color="#DBEAFE" />
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMessagesStore, Message } from "../state/messagesStore";
import { useStationStore } from "../state/stationStore";
import { useUserStore } from "../state/userStore";
import * as Notifications from "expo-notifications";

interface WhatsAppMessage extends Message {
  sender: string;
  isFromMe: boolean;
  messageType: "text" | "image" | "audio" | "system";
  status: "sent" | "delivered" | "read";
  timestamp: Date;
}

export default function MessagingScreen() {
  const { messages } = useMessagesStore();
  const stations = useStationStore((s) => s.stations);
  const user = useUserStore((s) => s.user);
  
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [nextShowTime] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000)); // 2 hours from now
  
  const scrollViewRef = useRef<ScrollView>(null);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      // Calculate countdown to next show
      const diff = nextShowTime.getTime() - now.getTime();
      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown({ hours, minutes, seconds });
      } else {
        setCountdown({ hours: 0, minutes: 0, seconds: 0 });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [nextShowTime]);

  // Load WhatsApp-style messages
  useEffect(() => {
    const mockWhatsAppMessages: WhatsAppMessage[] = [
      {
        id: "wa1",
        title: "Station Manager",
        body: "Good morning! Ready for today's show?",
        createdAtISO: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        sender: "Station Manager",
        isFromMe: false,
        messageType: "text",
        status: "read",
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        id: "wa2",
        title: "You",
        body: "Yes, all set! Just reviewing the script now.",
        createdAtISO: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        sender: "You",
        isFromMe: true,
        messageType: "text",
        status: "read",
        timestamp: new Date(Date.now() - 25 * 60 * 1000),
      },
      {
        id: "wa3",
        title: "Producer",
        body: "Weather update: Light rain expected around 3 PM",
        createdAtISO: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        sender: "Producer",
        isFromMe: false,
        messageType: "text",
        status: "delivered",
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
      },
      {
        id: "wa4",
        title: "News Desk",
        body: "Breaking: Local council meeting moved to 4 PM",
        createdAtISO: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        sender: "News Desk",
        isFromMe: false,
        messageType: "text",
        status: "sent",
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
      },
    ];
    
    setWhatsappMessages(mockWhatsAppMessages);
  }, []);

  // Request notification permissions
  useEffect(() => {
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Notifications Disabled",
          "Enable notifications to receive message alerts.",
          [{ text: "OK" }]
        );
      }
    };
    
    requestPermissions();
  }, []);

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message: WhatsAppMessage = {
        id: `wa_${Date.now()}`,
        title: "You",
        body: newMessage.trim(),
        createdAtISO: new Date().toISOString(),
        sender: "You",
        isFromMe: true,
        messageType: "text",
        status: "sent",
        timestamp: new Date(),
      };
      
      setWhatsappMessages(prev => [...prev, message]);
      setNewMessage("");
      
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // Mock auto-reply after 2 seconds
      setTimeout(() => {
        const autoReply: WhatsAppMessage = {
          id: `wa_auto_${Date.now()}`,
          title: "Station Manager",
          body: "Thanks for the update! 👍",
          createdAtISO: new Date().toISOString(),
          sender: "Station Manager",
          isFromMe: false,
          messageType: "text",
          status: "delivered",
          timestamp: new Date(),
        };
        
        setWhatsappMessages(prev => [...prev, autoReply]);
        
        // Send local notification
        Notifications.scheduleNotificationAsync({
          content: {
            title: "New Message",
            body: autoReply.body,
            data: { messageId: autoReply.id },
          },
          trigger: null,
        });
      }, 2000);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatCountdown = (time: { hours: number; minutes: number; seconds: number }) => {
    return `${time.hours.toString().padStart(2, "0")}:${time.minutes.toString().padStart(2, "0")}:${time.seconds.toString().padStart(2, "0")}`;
  };

  const currentStation = stations.find(s => s.id === user.currentStationId) || stations[0];

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header with Clock and Station Info */}
      <View className="bg-green-600 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-white text-lg font-bold">
              {currentStation?.name || "Radio Station"}
            </Text>
            <Text className="text-green-100 text-sm">
              {currentStation?.location?.city || "Live"}
            </Text>
          </View>
          
          <View className="items-end">
            <Text className="text-white text-2xl font-mono font-bold">
              {formatTime(currentTime)}
            </Text>
            <Text className="text-green-100 text-xs">
              {currentTime.toLocaleDateString()}
            </Text>
          </View>
        </View>
        
        {/* Countdown to Next Show */}
        <View className="mt-3 bg-green-700 rounded-lg p-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-green-100 text-sm">Next Show In:</Text>
            <Text className="text-white text-lg font-mono font-bold">
              {formatCountdown(countdown)}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages List */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 px-4 py-2"
        showsVerticalScrollIndicator={false}
      >
        {whatsappMessages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLast={index === whatsappMessages.length - 1}
          />
        ))}
      </ScrollView>

      {/* Message Input */}
      <View className="bg-white border-t border-gray-200 px-4 py-3">
        <View className="flex-row items-center space-x-3">
          <View className="flex-1 bg-gray-100 rounded-full px-4 py-2">
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor="#6B7280"
              className="text-gray-900"
              multiline
              maxLength={500}
            />
          </View>
          
          <Pressable
            onPress={sendMessage}
            disabled={!newMessage.trim()}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              newMessage.trim() ? "bg-green-600" : "bg-gray-300"
            }`}
          >
            <Ionicons 
              name="send" 
              size={18} 
              color={newMessage.trim() ? "white" : "#9CA3AF"} 
            />
          </Pressable>
        </View>
      </View>

      {/* System Messages Panel */}
      <View className="bg-yellow-50 border-t border-yellow-200 px-4 py-3 max-h-32">
        <Text className="text-yellow-800 font-medium text-sm mb-2">
          System Messages
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {messages.slice(0, 3).map((msg) => (
            <View key={msg.id} className="mb-2">
              <Text className="text-yellow-700 text-xs font-medium">
                {msg.title}
              </Text>
              <Text className="text-yellow-600 text-xs">
                {msg.body}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

interface MessageBubbleProps {
  message: WhatsAppMessage;
  isLast: boolean;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isFromMe = message.isFromMe;
  
  const getStatusIcon = () => {
    switch (message.status) {
      case "sent":
        return <Ionicons name="checkmark" size={12} color="#9CA3AF" />;
      case "delivered":
        return (
          <View className="flex-row">
            <Ionicons name="checkmark" size={12} color="#9CA3AF" />
            <Ionicons name="checkmark" size={12} color="#9CA3AF" style={{ marginLeft: -4 }} />
          </View>
        );
      case "read":
        return (
          <View className="flex-row">
            <Ionicons name="checkmark" size={12} color="#3B82F6" />
            <Ionicons name="checkmark" size={12} color="#3B82F6" style={{ marginLeft: -4 }} />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View className={`mb-2 ${isFromMe ? "items-end" : "items-start"}`}>
      {/* Sender name for incoming messages */}
      {!isFromMe && (
        <Text className="text-gray-500 text-xs mb-1 ml-3">
          {message.sender}
        </Text>
      )}
      
      {/* Message bubble */}
      <View
        className={`max-w-xs px-3 py-2 rounded-2xl ${
          isFromMe
            ? "bg-green-600 rounded-br-md"
            : "bg-white rounded-bl-md shadow-sm border border-gray-200"
        }`}
      >
        <Text className={`text-sm ${isFromMe ? "text-white" : "text-gray-900"}`}>
          {message.body}
        </Text>
        
        {/* Time and status */}
        <View className={`flex-row items-center justify-end mt-1 ${
          isFromMe ? "space-x-1" : ""
        }`}>
          <Text className={`text-xs ${
            isFromMe ? "text-green-100" : "text-gray-500"
          }`}>
            {formatTime(message.timestamp)}
          </Text>
          {isFromMe && getStatusIcon()}
        </View>
      </View>
    </View>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notificationManager, Notification } from '../utils/notifications';

export default function NotificationToast() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = notificationManager.subscribe((notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 2)]); // Keep max 3 notifications
    });

    return unsubscribe;
  }, []);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'close-circle';
      case 'warning': return 'warning';
      case 'info': return 'information-circle';
      default: return 'information-circle';
    }
  };

  const getColors = (type: Notification['type']) => {
    switch (type) {
      case 'success': return { bg: 'bg-green-500', text: 'text-white', icon: '#FFFFFF' };
      case 'error': return { bg: 'bg-red-500', text: 'text-white', icon: '#FFFFFF' };
      case 'warning': return { bg: 'bg-yellow-500', text: 'text-white', icon: '#FFFFFF' };
      case 'info': return { bg: 'bg-blue-500', text: 'text-white', icon: '#FFFFFF' };
      default: return { bg: 'bg-gray-500', text: 'text-white', icon: '#FFFFFF' };
    }
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    notificationManager.dismiss(id);
  };

  if (notifications.length === 0) return null;

  return (
    <View 
      className="absolute left-0 right-0 z-50 px-4"
      style={{ top: insets.top + 10 }}
    >
      {notifications.map((notification, index) => {
        const colors = getColors(notification.type);
        return (
          <NotificationItem
            key={notification.id}
            notification={notification}
            colors={colors}
            icon={getIcon(notification.type)}
            onDismiss={() => dismissNotification(notification.id)}
            style={{ marginTop: index * 10 }}
          />
        );
      })}
    </View>
  );
}

interface NotificationItemProps {
  notification: Notification;
  colors: { bg: string; text: string; icon: string };
  icon: keyof typeof Ionicons.glyphMap;
  onDismiss: () => void;
  style?: any;
}

function NotificationItem({ notification, colors, icon, onDismiss, style }: NotificationItemProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss if not persistent
    if (!notification.persistent && notification.duration) {
      const timer = setTimeout(() => {
        animateOut();
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, []);

  const animateOut = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        style,
      ]}
      className={`${colors.bg} rounded-lg p-4 mb-2 shadow-lg`}
    >
      <View className="flex-row items-start">
        <Ionicons name={icon} size={20} color={colors.icon} />
        <View className="flex-1 ml-3">
          <Text className={`${colors.text} font-semibold text-sm`}>
            {notification.title}
          </Text>
          <Text className={`${colors.text} text-sm opacity-90 mt-1`}>
            {notification.message}
          </Text>
        </View>
        <Pressable onPress={animateOut} className="ml-2 p-1">
          <Ionicons name="close" size={16} color={colors.icon} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
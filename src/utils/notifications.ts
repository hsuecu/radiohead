import * as Haptics from "expo-haptics";

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  duration?: number;
  persistent?: boolean;
}

class NotificationManager {
  private listeners: ((notification: Notification) => void)[] = [];
  private activeNotifications: Map<string, Notification> = new Map();

  subscribe(listener: (notification: Notification) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  show(notification: Omit<Notification, 'id' | 'timestamp'>) {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const fullNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      duration: notification.duration ?? 3000,
    };

    this.activeNotifications.set(id, fullNotification);
    this.listeners.forEach(listener => listener(fullNotification));

    // Provide haptic feedback
    this.provideHapticFeedback(notification.type);

    // Auto-dismiss if not persistent
    if (!notification.persistent && fullNotification.duration) {
      setTimeout(() => {
        this.dismiss(id);
      }, fullNotification.duration);
    }

    return id;
  }

  dismiss(id: string) {
    this.activeNotifications.delete(id);
    // Notify listeners about dismissal if needed
  }

  dismissAll() {
    this.activeNotifications.clear();
  }

  getActive(): Notification[] {
    return Array.from(this.activeNotifications.values());
  }

  private provideHapticFeedback(type: NotificationType) {
    try {
      switch (type) {
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'info':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
      }
    } catch (error) {
      // Haptic feedback not available, ignore
    }
  }

  // Convenience methods
  success(title: string, message: string, options?: Partial<Notification>) {
    return this.show({ type: 'success', title, message, ...options });
  }

  error(title: string, message: string, options?: Partial<Notification>) {
    return this.show({ type: 'error', title, message, ...options });
  }

  info(title: string, message: string, options?: Partial<Notification>) {
    return this.show({ type: 'info', title, message, ...options });
  }

  warning(title: string, message: string, options?: Partial<Notification>) {
    return this.show({ type: 'warning', title, message, ...options });
  }

  // Upload-specific notifications
  uploadStarted(filename: string, provider: string) {
    return this.info(
      'Upload Started',
      `Uploading ${filename} to ${provider}`,
      { duration: 2000 }
    );
  }

  uploadProgress(filename: string, progress: number) {
    // Only show progress notifications at certain milestones to avoid spam
    if (progress === 0.25 || progress === 0.5 || progress === 0.75) {
      return this.info(
        'Upload Progress',
        `${filename} is ${Math.round(progress * 100)}% complete`,
        { duration: 1500 }
      );
    }
  }

  uploadCompleted(filename: string, provider: string) {
    return this.success(
      'Upload Complete',
      `${filename} uploaded to ${provider}`,
      { duration: 4000 }
    );
  }

  uploadFailed(filename: string, error: string) {
    return this.error(
      'Upload Failed',
      `${filename}: ${error}`,
      { duration: 5000 }
    );
  }

  queueProcessingStarted(count: number) {
    return this.info(
      'Processing Queue',
      `Starting upload of ${count} file${count > 1 ? 's' : ''}`,
      { duration: 2000 }
    );
  }

  queueProcessingCompleted(successful: number, failed: number) {
    if (failed === 0) {
      return this.success(
        'Queue Complete',
        `Successfully uploaded ${successful} file${successful > 1 ? 's' : ''}`,
        { duration: 4000 }
      );
    } else {
      return this.warning(
        'Queue Complete',
        `${successful} successful, ${failed} failed`,
        { duration: 5000 }
      );
    }
  }
}

export const notificationManager = new NotificationManager();
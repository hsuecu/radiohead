import { create } from "zustand";
import * as SQLite from "expo-sqlite";

export type MessageType = "text" | "image" | "file" | "system";
export type ChatType = "internal" | "external";

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  type: MessageType;
  content: string;
  fileUri?: string;
  fileName?: string;
  fileSize?: number;
  timestamp: string;
  isRead: boolean;
  isDelivered: boolean;
  replyToId?: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  type: ChatType;
  participants: string[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  isBlocked?: boolean;
  organizationId?: string;
}

export interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: string;
  organizationId?: string;
  isBlocked: boolean;
}

export interface ChatState {
  database: SQLite.SQLiteDatabase | null;
  rooms: ChatRoom[];
  messages: Record<string, ChatMessage[]>; // chatId -> messages
  users: ChatUser[];
  currentUserId: string | null;
  isTyping: Record<string, string[]>; // chatId -> userIds typing
  
  // Database operations
  initializeDatabase: () => Promise<void>;
  
  // Room management
  createRoom: (name: string, type: ChatType, participants: string[]) => Promise<string>;
  getRooms: (type?: ChatType) => ChatRoom[];
  updateRoom: (roomId: string, updates: Partial<ChatRoom>) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
  blockRoom: (roomId: string) => Promise<void>;
  unblockRoom: (roomId: string) => Promise<void>;
  
  // Message management
  sendMessage: (chatId: string, content: string, type?: MessageType, fileUri?: string) => Promise<void>;
  getMessages: (chatId: string, limit?: number, offset?: number) => Promise<ChatMessage[]>;
  markMessagesAsRead: (chatId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  replyToMessage: (chatId: string, content: string, replyToId: string) => Promise<void>;
  
  // User management
  addUser: (user: Omit<ChatUser, "id">) => Promise<string>;
  updateUser: (userId: string, updates: Partial<ChatUser>) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  setUserOnlineStatus: (userId: string, isOnline: boolean) => Promise<void>;
  
  // Typing indicators
  setTyping: (chatId: string, userId: string, isTyping: boolean) => void;
  
  // Search
  searchMessages: (query: string, chatId?: string) => Promise<ChatMessage[]>;
  
  // File handling
  uploadFile: (fileUri: string, fileName: string) => Promise<string>;
  
  // Helper methods
  loadRooms: () => Promise<void>;
  loadUsers: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  database: null,
  rooms: [],
  messages: {},
  users: [],
  currentUserId: null,
  isTyping: {},

  initializeDatabase: async () => {
    try {
      const db = await SQLite.openDatabaseAsync("chat.db");
      
      // Create tables
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        
        CREATE TABLE IF NOT EXISTS chat_rooms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          participants TEXT NOT NULL,
          unread_count INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          is_blocked INTEGER DEFAULT 0,
          organization_id TEXT
        );
        
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          sender_name TEXT NOT NULL,
          sender_avatar TEXT,
          type TEXT NOT NULL DEFAULT 'text',
          content TEXT NOT NULL,
          file_uri TEXT,
          file_name TEXT,
          file_size INTEGER,
          timestamp TEXT NOT NULL,
          is_read INTEGER DEFAULT 0,
          is_delivered INTEGER DEFAULT 1,
          reply_to_id TEXT,
          FOREIGN KEY (chat_id) REFERENCES chat_rooms (id) ON DELETE CASCADE
        );
        
        CREATE TABLE IF NOT EXISTS chat_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          avatar TEXT,
          is_online INTEGER DEFAULT 0,
          last_seen TEXT,
          organization_id TEXT,
          is_blocked INTEGER DEFAULT 0
        );
        
        CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON chat_messages(chat_id);
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON chat_messages(timestamp);
        CREATE INDEX IF NOT EXISTS idx_rooms_type ON chat_rooms(type);
      `);
      
      set({ database: db });
      
      // Load initial data
      await get().loadRooms();
      await get().loadUsers();
      
    } catch (error) {
      console.error("Failed to initialize chat database:", error);
    }
  },

  createRoom: async (name, type, participants) => {
    const db = get().database;
    if (!db) throw new Error("Database not initialized");
    
    const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();
    
    await db.runAsync(
      `INSERT INTO chat_rooms (id, name, type, participants, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      roomId, name, type, JSON.stringify(participants), now, now
    );
    
    await get().loadRooms();
    return roomId;
  },

  getRooms: (type) => {
    const rooms = get().rooms;
    return type ? rooms.filter(room => room.type === type) : rooms;
  },

  updateRoom: async (roomId, updates) => {
    const db = get().database;
    if (!db) throw new Error("Database not initialized");
    
    const updateFields = [];
    const values = [];
    
    if (updates.name) {
      updateFields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.participants) {
      updateFields.push("participants = ?");
      values.push(JSON.stringify(updates.participants));
    }
    if (updates.isBlocked !== undefined) {
      updateFields.push("is_blocked = ?");
      values.push(updates.isBlocked ? 1 : 0);
    }
    
    updateFields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(roomId);
    
    await db.runAsync(
      `UPDATE chat_rooms SET ${updateFields.join(", ")} WHERE id = ?`,
      ...values
    );
    
    await get().loadRooms();
  },

  deleteRoom: async (roomId) => {
    const db = get().database;
    if (!db) throw new Error("Database not initialized");
    
    await db.runAsync("DELETE FROM chat_rooms WHERE id = ?", roomId);
    await get().loadRooms();
  },

  blockRoom: async (roomId) => {
    await get().updateRoom(roomId, { isBlocked: true });
  },

  unblockRoom: async (roomId) => {
    await get().updateRoom(roomId, { isBlocked: false });
  },

  sendMessage: async (chatId, content, type = "text", fileUri) => {
    const db = get().database;
    if (!db) throw new Error("Database not initialized");
    
    const currentUserId = get().currentUserId;
    if (!currentUserId) throw new Error("No current user");
    
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();
    
    // Get current user info
    const currentUser = get().users.find(u => u.id === currentUserId);
    const senderName = currentUser?.name || "Unknown User";
    const senderAvatar = currentUser?.avatar;
    
    await db.runAsync(
      `INSERT INTO chat_messages 
       (id, chat_id, sender_id, sender_name, sender_avatar, type, content, file_uri, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      messageId, chatId, currentUserId, senderName, senderAvatar || null, type, content, fileUri || null, now
    );
    
    // Update room's last message and timestamp
    await db.runAsync(
      "UPDATE chat_rooms SET updated_at = ? WHERE id = ?",
      now, chatId
    );
    
    await get().loadMessages(chatId);
    await get().loadRooms();
  },

  getMessages: async (chatId, limit = 50, offset = 0) => {
    const db = get().database;
    if (!db) throw new Error("Database not initialized");
    
    const messages = await db.getAllAsync<any>(
      `SELECT * FROM chat_messages 
       WHERE chat_id = ? 
       ORDER BY timestamp DESC 
       LIMIT ? OFFSET ?`,
      chatId, limit, offset
    );
    
    return messages.map(msg => ({
      id: msg.id,
      chatId: msg.chat_id,
      senderId: msg.sender_id,
      senderName: msg.sender_name,
      senderAvatar: msg.sender_avatar,
      type: msg.type as MessageType,
      content: msg.content,
      fileUri: msg.file_uri,
      fileName: msg.file_name,
      fileSize: msg.file_size,
      timestamp: msg.timestamp,
      isRead: Boolean(msg.is_read),
      isDelivered: Boolean(msg.is_delivered),
      replyToId: msg.reply_to_id,
    })).reverse();
  },

  markMessagesAsRead: async (chatId) => {
    const db = get().database;
    if (!db) throw new Error("Database not initialized");
    
    await db.runAsync(
      "UPDATE chat_messages SET is_read = 1 WHERE chat_id = ? AND is_read = 0",
      chatId
    );
    
    await db.runAsync(
      "UPDATE chat_rooms SET unread_count = 0 WHERE id = ?",
      chatId
    );
    
    await get().loadMessages(chatId);
    await get().loadRooms();
  },

  deleteMessage: async (messageId) => {
    const db = get().database;
    if (!db) throw new Error("Database not initialized");
    
    await db.runAsync("DELETE FROM chat_messages WHERE id = ?", messageId);
    // Reload messages for affected chat
    // Note: In a real implementation, you'd want to track which chat this message belonged to
  },

  replyToMessage: async (chatId, content, replyToId) => {
    const db = get().database;
    if (!db) throw new Error("Database not initialized");
    
    const currentUserId = get().currentUserId;
    if (!currentUserId) throw new Error("No current user");
    
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();
    
    const currentUser = get().users.find(u => u.id === currentUserId);
    const senderName = currentUser?.name || "Unknown User";
    const senderAvatar = currentUser?.avatar;
    
    await db.runAsync(
      `INSERT INTO chat_messages 
       (id, chat_id, sender_id, sender_name, sender_avatar, type, content, timestamp, reply_to_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      messageId, chatId, currentUserId, senderName, senderAvatar || null, "text", content, now, replyToId
    );
    
    await get().loadMessages(chatId);
  },

  addUser: async (user) => {
    const db = get().database;
    if (!db) throw new Error("Database not initialized");
    
    const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    
    await db.runAsync(
      `INSERT INTO chat_users (id, name, avatar, is_online, organization_id, is_blocked) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      userId, user.name, user.avatar || null, user.isOnline ? 1 : 0, user.organizationId || null, user.isBlocked ? 1 : 0
    );
    
    await get().loadUsers();
    return userId;
  },

  updateUser: async (userId, updates) => {
    const db = get().database;
    if (!db) throw new Error("Database not initialized");
    
    const updateFields = [];
    const values = [];
    
    if (updates.name) {
      updateFields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.avatar !== undefined) {
      updateFields.push("avatar = ?");
      values.push(updates.avatar);
    }
    if (updates.isOnline !== undefined) {
      updateFields.push("is_online = ?");
      values.push(updates.isOnline ? 1 : 0);
    }
    if (updates.isBlocked !== undefined) {
      updateFields.push("is_blocked = ?");
      values.push(updates.isBlocked ? 1 : 0);
    }
    
    values.push(userId);
    
    await db.runAsync(
      `UPDATE chat_users SET ${updateFields.join(", ")} WHERE id = ?`,
      ...values
    );
    
    await get().loadUsers();
  },

  blockUser: async (userId) => {
    await get().updateUser(userId, { isBlocked: true });
  },

  unblockUser: async (userId) => {
    await get().updateUser(userId, { isBlocked: false });
  },

  setUserOnlineStatus: async (userId, isOnline) => {
    const updates: Partial<ChatUser> = { isOnline };
    if (!isOnline) {
      updates.lastSeen = new Date().toISOString();
    }
    await get().updateUser(userId, updates);
  },

  setTyping: (chatId, userId, isTyping) => {
    const currentTyping = get().isTyping;
    const chatTyping = currentTyping[chatId] || [];
    
    if (isTyping && !chatTyping.includes(userId)) {
      set({
        isTyping: {
          ...currentTyping,
          [chatId]: [...chatTyping, userId]
        }
      });
    } else if (!isTyping && chatTyping.includes(userId)) {
      set({
        isTyping: {
          ...currentTyping,
          [chatId]: chatTyping.filter(id => id !== userId)
        }
      });
    }
  },

  searchMessages: async (query, chatId) => {
    const db = get().database;
    if (!db) throw new Error("Database not initialized");
    
    let sql = `SELECT * FROM chat_messages WHERE content LIKE ?`;
    const params = [`%${query}%`];
    
    if (chatId) {
      sql += ` AND chat_id = ?`;
      params.push(chatId);
    }
    
    sql += ` ORDER BY timestamp DESC LIMIT 100`;
    
    const messages = await db.getAllAsync<any>(sql, ...params);
    
    return messages.map(msg => ({
      id: msg.id,
      chatId: msg.chat_id,
      senderId: msg.sender_id,
      senderName: msg.sender_name,
      senderAvatar: msg.sender_avatar,
      type: msg.type as MessageType,
      content: msg.content,
      fileUri: msg.file_uri,
      fileName: msg.file_name,
      fileSize: msg.file_size,
      timestamp: msg.timestamp,
      isRead: Boolean(msg.is_read),
      isDelivered: Boolean(msg.is_delivered),
      replyToId: msg.reply_to_id,
    }));
  },

  uploadFile: async (_fileUri, fileName) => {
    // Mock implementation - in real app, upload to cloud storage
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `uploaded_${Date.now()}_${fileName}`;
  },

  // Helper methods (not exposed in interface)
  loadRooms: async () => {
    const db = get().database;
    if (!db) return;
    
    const rooms = await db.getAllAsync<any>("SELECT * FROM chat_rooms ORDER BY updated_at DESC");
    
    set({
      rooms: rooms.map(room => ({
        id: room.id,
        name: room.name,
        type: room.type as ChatType,
        participants: JSON.parse(room.participants),
        unreadCount: room.unread_count,
        createdAt: room.created_at,
        updatedAt: room.updated_at,
        isBlocked: Boolean(room.is_blocked),
        organizationId: room.organization_id,
      }))
    });
  },

  loadUsers: async () => {
    const db = get().database;
    if (!db) return;
    
    const users = await db.getAllAsync<any>("SELECT * FROM chat_users");
    
    set({
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        isOnline: Boolean(user.is_online),
        lastSeen: user.last_seen,
        organizationId: user.organization_id,
        isBlocked: Boolean(user.is_blocked),
      }))
    });
  },

  loadMessages: async (chatId: string) => {
    const messages = await get().getMessages(chatId);
    set({
      messages: {
        ...get().messages,
        [chatId]: messages
      }
    });
  },
}));
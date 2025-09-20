import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type SocialPlatform = "twitter" | "facebook" | "instagram" | "metricool";

export interface SocialMediaPost {
  id: string;
  content: string;
  imageUri?: string;
  platforms: SocialPlatform[];
  scheduledFor?: string; // ISO string
  status: "draft" | "scheduled" | "posting" | "posted" | "failed";
  createdAt: string;
  updatedAt: string;
  sourceContent?: {
    title: string;
    url?: string;
    type: "news" | "manual";
  };
  postResults?: {
    platform: SocialPlatform;
    success: boolean;
    postId?: string;
    error?: string;
  }[];
}

export interface SocialMediaConfig {
  twitter: {
    enabled: boolean;
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    accessTokenSecret?: string;
  };
  facebook: {
    enabled: boolean;
    pageId?: string;
    accessToken?: string;
  };
  instagram: {
    enabled: boolean;
    businessAccountId?: string;
    accessToken?: string;
  };
  metricool: {
    enabled: boolean;
    apiKey?: string;
  };
}

export interface SocialMediaState {
  posts: SocialMediaPost[];
  config: SocialMediaConfig;
  
  // Post management
  addPost: (post: Omit<SocialMediaPost, "id" | "createdAt" | "updatedAt" | "status">) => void;
  updatePost: (id: string, updates: Partial<SocialMediaPost>) => void;
  deletePost: (id: string) => void;
  duplicatePost: (id: string) => void;
  
  // Queue management
  schedulePost: (id: string, scheduledFor: string) => void;
  publishPost: (id: string) => Promise<void>;
  publishAllScheduled: () => Promise<void>;
  
  // Configuration
  updateConfig: (platform: SocialPlatform, config: any) => void;
  
  // Content creation helpers
  createPostFromNews: (newsItem: any) => void;
  createPostFromContent: (content: string, title?: string) => void;
}

const DEFAULT_CONFIG: SocialMediaConfig = {
  twitter: { enabled: false },
  facebook: { enabled: false },
  instagram: { enabled: false },
  metricool: { enabled: false },
};

export const useSocialMediaStore = create<SocialMediaState>()(
  persist(
    (set, get) => ({
      posts: [],
      config: DEFAULT_CONFIG,

      addPost: (post) => {
        const now = new Date().toISOString();
        const newPost: SocialMediaPost = {
          ...post,
          id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          status: "draft",
          createdAt: now,
          updatedAt: now,
        };
        
        set({ posts: [newPost, ...get().posts] });
      },

      updatePost: (id, updates) => {
        const posts = get().posts.map(post => 
          post.id === id 
            ? { ...post, ...updates, updatedAt: new Date().toISOString() }
            : post
        );
        set({ posts });
      },

      deletePost: (id) => {
        const posts = get().posts.filter(post => post.id !== id);
        set({ posts });
      },

      duplicatePost: (id) => {
        const originalPost = get().posts.find(post => post.id === id);
        if (originalPost) {
          const now = new Date().toISOString();
          const duplicatedPost: SocialMediaPost = {
            ...originalPost,
            id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            status: "draft",
            createdAt: now,
            updatedAt: now,
            content: `${originalPost.content} (Copy)`,
          };
          
          set({ posts: [duplicatedPost, ...get().posts] });
        }
      },

      schedulePost: (id, scheduledFor) => {
        get().updatePost(id, { 
          scheduledFor, 
          status: "scheduled" 
        });
      },

      publishPost: async (id) => {
        const post = get().posts.find(p => p.id === id);
        if (!post) return;

        get().updatePost(id, { status: "posting" });

        try {
          const results = await publishToSocialPlatforms(post, get().config);
          get().updatePost(id, { 
            status: results.every(r => r.success) ? "posted" : "failed",
            postResults: results 
          });
        } catch (error) {
          console.error("Failed to publish post:", error);
          get().updatePost(id, { status: "failed" });
        }
      },

      publishAllScheduled: async () => {
        const now = new Date();
        const scheduledPosts = get().posts.filter(post => 
          post.status === "scheduled" && 
          post.scheduledFor && 
          new Date(post.scheduledFor) <= now
        );

        for (const post of scheduledPosts) {
          await get().publishPost(post.id);
        }
      },

      updateConfig: (platform, config) => {
        set({
          config: {
            ...get().config,
            [platform]: { ...get().config[platform], ...config }
          }
        });
      },

      createPostFromNews: (newsItem) => {
        const content = formatNewsForSocial(newsItem);
        get().addPost({
          content,
          platforms: getEnabledPlatforms(get().config),
          sourceContent: {
            title: newsItem.title,
            url: newsItem.link,
            type: "news"
          }
        });
      },

      createPostFromContent: (content, title) => {
        get().addPost({
          content,
          platforms: getEnabledPlatforms(get().config),
          sourceContent: title ? {
            title,
            type: "manual"
          } : undefined
        });
      },
    }),
    {
      name: "social-media-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        posts: state.posts,
        config: state.config,
      }),
    }
  )
);

// Helper functions
function formatNewsForSocial(newsItem: any): string {
  const title = newsItem.title || "";
  const url = newsItem.link || "";
  
  let content = title;
  
  // Add hashtags based on content
  const hashtags = generateHashtags(title);
  if (hashtags.length > 0) {
    content += "\n\n" + hashtags.join(" ");
  }
  
  if (url) {
    content += "\n\n" + url;
  }
  
  return content;
}

function generateHashtags(text: string): string[] {
  const hashtags: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Simple hashtag generation based on keywords
  const keywordMap: Record<string, string> = {
    "breaking": "#Breaking",
    "news": "#News",
    "weather": "#Weather",
    "traffic": "#Traffic",
    "sports": "#Sports",
    "music": "#Music",
    "local": "#Local",
    "update": "#Update",
    "alert": "#Alert",
  };
  
  Object.entries(keywordMap).forEach(([keyword, hashtag]) => {
    if (lowerText.includes(keyword) && !hashtags.includes(hashtag)) {
      hashtags.push(hashtag);
    }
  });
  
  return hashtags.slice(0, 3); // Limit to 3 hashtags
}

function getEnabledPlatforms(config: SocialMediaConfig): SocialPlatform[] {
  return (Object.keys(config) as SocialPlatform[]).filter(
    platform => config[platform].enabled
  );
}

async function publishToSocialPlatforms(
  post: SocialMediaPost, 
  config: SocialMediaConfig
): Promise<{ platform: SocialPlatform; success: boolean; postId?: string; error?: string }[]> {
  const results: { platform: SocialPlatform; success: boolean; postId?: string; error?: string }[] = [];
  
  for (const platform of post.platforms) {
    if (!config[platform].enabled) {
      results.push({ platform, success: false, error: "Platform not enabled" });
      continue;
    }
    
    try {
      // Mock implementation - in real app, integrate with actual APIs
      const postId = await mockPublishToPlatform(platform, post, config[platform]);
      results.push({ platform, success: true, postId });
    } catch (error) {
      results.push({ 
        platform, 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  }
  
  return results;
}

async function mockPublishToPlatform(
  platform: SocialPlatform, 
  _post: SocialMediaPost, 
  _platformConfig: any
): Promise<string> {
  // Mock delay to simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  // Mock success/failure (90% success rate)
  if (Math.random() < 0.9) {
    return `${platform}_${Date.now()}`;
  } else {
    throw new Error(`Failed to post to ${platform}`);
  }
}
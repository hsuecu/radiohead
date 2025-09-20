export type Role = "Owner" | "Admin" | "Editor" | "Viewer";

export type Station = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  timezone?: string;
  contacts?: { email?: string };
  integrations?: { dropboxLinked?: boolean };
  branding?: {
    primaryColor?: string;
    logoUri?: string;
  };
  location?: { city?: string; lat?: number; lon?: number };
  dashboardSections?: DashboardSection[];
};

export interface DashboardSection {
  id: string;
  name: string;
  type: "news" | "weather" | "rss" | "api";
  enabled: boolean;
  order: number;
  config: {
    rssUrl?: string;
    apiEndpoint?: string;
    location?: string;
    category?: string;
    refreshInterval?: number;
  };
}

export type StationMembership = {
  stationId: string;
  role: Role;
};

export type Invitation = {
  id: string;
  stationId: string;
  email: string;
  role: Role;
  code: string;
  status: "pending" | "accepted" | "cancelled";
  createdAt: number;
  createdBy: string;
};

export type CategoryOption = { id: string; name: string; code: string; icon?: string };
export const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: "news", name: "News", code: "NEWS", icon: "newspaper" },
  { id: "traffic", name: "Traffic & Travel", code: "TRAF", icon: "car" },
  { id: "sport", name: "Sport", code: "SPORT", icon: "football" },
  { id: "weather", name: "Weather", code: "WX", icon: "partly-sunny" },
  { id: "voicetrack", name: "Voice Track", code: "VT", icon: "mic" },
  { id: "interview", name: "Interview", code: "INT", icon: "people" },
  { id: "promo", name: "Promo/Trail", code: "PR", icon: "megaphone" },
  { id: "adread", name: "Ad Read", code: "ADR", icon: "reader" },
  { id: "id", name: "ID/Imaging", code: "ID", icon: "musical-notes" },
  { id: "sfx", name: "Bed/SFX", code: "SFX", icon: "musical-notes" },
  { id: "event", name: "Event", code: "EVT", icon: "calendar" },
  { id: "emergency", name: "Emergency/Compliance", code: "EMD", icon: "alert" },
  { id: "other", name: "Other", code: "OTH", icon: "folder" },
];

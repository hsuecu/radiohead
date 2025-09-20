import React, { useState } from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUserStore } from "../state/userStore";
import { useStationStore } from "../state/stationStore";
import { getRoleForStation } from "../state/userStore";
import { useNavigation } from "@react-navigation/native";
import { canManageStations } from "../utils/rbac";

export function StationPill() {
  const [open, setOpen] = useState(false);
  const user = useUserStore((s) => s.user);
  const setCurrent = useUserStore((s) => s.setCurrentStation);
  const stations = useStationStore((s) => s.stations);
  const currentStation = stations.find((s) => s.id === user.currentStationId) || stations[0];
  const role = getRoleForStation(currentStation?.id || "");
  const nav = useNavigation<any>();
  const canManage = canManageStations(role as any);

  return (
    <View className="mb-3">
      <Pressable onPress={() => setOpen(true)} className="self-center px-3 py-1 rounded-full bg-gray-100 border border-gray-200 flex-row items-center">
        <Ionicons name="radio" size={14} color="#374151" />
        <Text className="ml-2 text-gray-800 font-medium">{currentStation?.name || "Select Station"}</Text>
        <View className="ml-2 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200">
          <Text className="text-blue-700 text-xs">{role}</Text>
        </View>
        <Ionicons name="chevron-down" size={16} color="#6B7280" style={{ marginLeft: 6 }} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 items-center justify-center bg-black bg-opacity-50">
          <View className="bg-white rounded-2xl p-4 w-11/12 max-w-md">
            <Text className="text-lg font-semibold text-gray-800 mb-2">Switch Station</Text>
            <Text className="text-gray-600 mb-3">Only stations you are assigned to are shown</Text>
            {canManage && (
              <Pressable onPress={() => { setOpen(false); nav.navigate('StationManage'); }} className="mb-3 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
                <Text className="text-gray-800">Manage stations…</Text>
              </Pressable>
            )}
            <Pressable onPress={() => { setOpen(false); nav.navigate('AcceptInvite'); }} className="mb-3 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
              <Text className="text-gray-800">Accept invitation…</Text>
            </Pressable>
            <Pressable onPress={() => { setOpen(false); nav.navigate('Files' as never); }} className="mb-3 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
              <Text className="text-gray-800">Open Files…</Text>
            </Pressable>
            <Pressable onPress={() => { setOpen(false); nav.navigate('Profile' as never); }} className="mb-3 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
              <Text className="text-gray-800">Profile…</Text>
            </Pressable>
            <ScrollView style={{ maxHeight: 320 }}>
              {user.memberships.map((m) => {
                const st = stations.find((s) => s.id === m.stationId);
                if (!st) return null;
                const isActive = user.currentStationId === st.id;
                return (
                  <Pressable
                    key={st.id}
                    onPress={() => { setCurrent(st.id); setOpen(false); }}
                    className={`p-3 rounded-lg border-2 mb-2 ${isActive ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <Ionicons name="radio" size={18} color={isActive ? "#3B82F6" : "#6B7280"} />
                        <Text className={`ml-2 font-medium ${isActive ? "text-blue-700" : "text-gray-800"}`}>{st.name}</Text>
                      </View>
                      <View className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
                        <Text className="text-gray-700 text-xs">{m.role}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} className="mt-2 bg-gray-200 rounded-lg p-3">
              <Text className="text-center text-gray-700 font-medium">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

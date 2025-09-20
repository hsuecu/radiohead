import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as MailComposer from "expo-mail-composer";
import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import { useStationStore } from "../state/stationStore";
import { useUserStore } from "../state/userStore";
import { useAudioStore } from "../state/audioStore";
import { canManageStations } from "../utils/rbac";
import { Role } from "../types/station";

export default function StationManagementScreen() {
  const { stations, upsertStation, deleteStation, invitations, createInvitation, cancelInvitation } = useStationStore();
  const { user, removeMembership } = useUserStore();
  const purgeStation = useAudioStore((s) => s.purgeStation);
  const [editing, setEditing] = useState<{ id?: string; name: string; code?: string; description?: string; primaryColor?: string; email?: string } | null>(null);
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("Editor");
  const myRole = useMemo(() => user.currentStationId ? user.memberships.find(m => m.stationId === user.currentStationId)?.role || "Viewer" : "Viewer", [user]);
  const canManage = canManageStations(myRole as Role);

  const openCreate = () => setEditing({ name: "", code: "", description: "", primaryColor: "#2563EB", email: "" });
  const openEdit = (id: string) => {
    const s = stations.find(x => x.id === id);
    if (!s) return;
    setEditing({ id: s.id, name: s.name, code: s.code, description: s.description, primaryColor: s.branding?.primaryColor, email: s.contacts?.email });
  };

  const saveStation = () => {
    if (!editing || !editing.name.trim()) return;
    const id = editing.id ?? `station-${Crypto.randomUUID().slice(0,6)}`;
    upsertStation({ id, name: editing.name.trim(), code: editing.code?.trim(), description: editing.description?.trim(), branding: { primaryColor: editing.primaryColor }, contacts: { email: editing.email } });
    setEditing(null);
  };

  const reallyDelete = async (id: string) => {
    // remove files directory
    const dir = `${FileSystem.documentDirectory}stations/${id}`;
    try { await FileSystem.deleteAsync(dir, { idempotent: true }); } catch {}
    purgeStation(id);
    deleteStation(id);
    removeMembership(id);
  };

  const sendInvite = async (stationId: string) => {
    const email = inviteEmail.trim();
    if (!email) return;
    const invId = Crypto.randomUUID();
    const code = invId.slice(0,6).toUpperCase();
    createInvitation({ id: invId, stationId, email, role: inviteRole, code, status: "pending", createdAt: Date.now(), createdBy: user.id } as any);
    try {
      await MailComposer.composeAsync({
        recipients: [email],
        subject: `Invitation to join station`,
        body: `You have been invited to join station. Use code ${code} in the app to accept.`,
      });
    } catch {}
    setInviteFor(null);
    setInviteEmail("");
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
        <View className="bg-white px-6 py-4 border-b border-gray-200">
          <Text className="text-2xl font-bold text-gray-800">Station Management</Text>
          <Text className="text-gray-600">Create, edit, delete stations and manage invitations</Text>
        </View>

        <View className="bg-white mt-2 px-6 py-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-semibold text-gray-800">Stations ({stations.length})</Text>
            <Pressable disabled={!canManage} onPress={openCreate} className={`px-3 py-2 rounded-lg ${canManage ? 'bg-blue-500' : 'bg-blue-300'}`}>
              <Text className="text-white font-medium">New Station</Text>
            </Pressable>
          </View>

          <View className="space-y-3">
            {stations.filter(s => user.memberships.some(m => m.stationId === s.id)).map((s) => (
              <View key={s.id} className="p-4 rounded-lg border-2 border-gray-200 bg-gray-50">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="font-medium text-gray-800">{s.name}</Text>
                    {!!s.code && <Text className="text-gray-500 text-xs">Code: {s.code}</Text>}
                  </View>
                  <View className="flex-row items-center">
                    <Pressable disabled={!canManage} onPress={() => setInviteFor(s.id)} className={`rounded-full w-9 h-9 items-center justify-center mr-2 ${canManage ? 'bg-purple-500' : 'bg-purple-300'}`}>
                      <Ionicons name="mail" size={16} color="white" />
                    </Pressable>
                    <Pressable disabled={!canManage} onPress={() => openEdit(s.id)} className={`rounded-full w-9 h-9 items-center justify-center mr-2 ${canManage ? 'bg-gray-200' : 'bg-gray-100'}`}>
                      <Ionicons name="pencil" size={16} color="#374151" />
                    </Pressable>
                    <Pressable disabled={user.memberships.find(m=>m.stationId===s.id)?.role !== 'Owner'} onPress={() => reallyDelete(s.id)} className={`rounded-full w-9 h-9 items-center justify-center ${user.memberships.find(m=>m.stationId===s.id)?.role === 'Owner' ? 'bg-red-500' : 'bg-red-300'}`}>
                      <Ionicons name="trash" size={16} color="white" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="bg-white mt-2 px-6 py-4 mb-6">
          <Text className="text-lg font-semibold text-gray-800 mb-2">Pending Invitations</Text>
          <View className="space-y-2">
            {invitations.filter(i=>i.status==='pending' && user.memberships.some(m=>m.stationId===i.stationId)).map((i) => (
              <View key={i.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                <Text className="text-gray-800">{i.email} → {i.role} • {i.stationId}</Text>
                <View className="flex-row mt-2">
                  <Pressable onPress={() => cancelInvitation(i.id)} className="bg-gray-200 rounded-lg px-3 py-1 mr-2"><Text className="text-gray-700">Cancel</Text></Pressable>
                </View>
              </View>
            ))}
            {invitations.filter(i=>i.status==='pending').length===0 && <Text className="text-gray-500">No pending invitations</Text>}
          </View>
        </View>
      </ScrollView>

      {/* Station editor */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-xl font-bold text-gray-800 mb-2">{editing?.id ? 'Edit Station' : 'New Station'}</Text>
            <Text className="text-gray-700 mb-2">Name</Text>
            <TextInput value={editing?.name ?? ''} onChangeText={(t)=> setEditing(e => e ? { ...e, name: t } : e)} placeholder="Station name" className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-3" />
            <Text className="text-gray-700 mb-2">Code</Text>
            <TextInput value={editing?.code ?? ''} onChangeText={(t)=> setEditing(e => e ? { ...e, code: t } : e)} placeholder="Code" className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-3" />
            <Text className="text-gray-700 mb-2">Description</Text>
            <TextInput value={editing?.description ?? ''} onChangeText={(t)=> setEditing(e => e ? { ...e, description: t } : e)} placeholder="Description" className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-3" />
            <Text className="text-gray-700 mb-2">Primary Color</Text>
            <TextInput value={editing?.primaryColor ?? ''} onChangeText={(t)=> setEditing(e => e ? { ...e, primaryColor: t } : e)} placeholder="#2563EB" className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-3" />
            <Text className="text-gray-700 mb-2">Contact Email</Text>
            <TextInput value={editing?.email ?? ''} onChangeText={(t)=> setEditing(e => e ? { ...e, email: t } : e)} placeholder="contact@example.com" className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-4" />

            <View className="flex-row">
              <Pressable onPress={() => setEditing(null)} className="flex-1 bg-gray-200 rounded-lg p-3 mr-2"><Text className="text-center text-gray-700 font-medium">Cancel</Text></Pressable>
              <Pressable onPress={saveStation} className="flex-1 bg-blue-500 rounded-lg p-3 ml-2"><Text className="text-center text-white font-medium">Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite modal */}
      <Modal visible={!!inviteFor} transparent animationType="slide" onRequestClose={() => setInviteFor(null)}>
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-xl font-bold text-gray-800 mb-2">Invite User</Text>
            <Text className="text-gray-700 mb-2">Email</Text>
            <TextInput value={inviteEmail} onChangeText={setInviteEmail} placeholder="user@example.com" className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-3" />
            <Text className="text-gray-700 mb-2">Role</Text>
            <View className="flex-row mb-4">
              {(["Owner","Admin","Editor","Viewer"] as Role[]).map((r) => (
                <Pressable key={r} onPress={() => setInviteRole(r)} className={`px-3 py-2 rounded-full border-2 mr-2 ${inviteRole===r ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}>
                  <Text className={`${inviteRole===r ? 'text-blue-700' : 'text-gray-700'}`}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row">
              <Pressable onPress={() => setInviteFor(null)} className="flex-1 bg-gray-200 rounded-lg p-3 mr-2"><Text className="text-center text-gray-700 font-medium">Cancel</Text></Pressable>
              <Pressable onPress={() => inviteFor && sendInvite(inviteFor)} className="flex-1 bg-purple-500 rounded-lg p-3 ml-2"><Text className="text-center text-white font-medium">Send Invite</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

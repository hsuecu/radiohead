import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { useStationStore } from "../state/stationStore";
import { useUserStore } from "../state/userStore";

export default function AcceptInvitationScreen() {
  const { invitations, markInvitationAccepted } = useStationStore();
  const addMembership = useUserStore((s) => s.addMembership);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const accept = () => {
    setStatus(null);
    const inv = invitations.find(i => i.status === 'pending' && i.email.toLowerCase() === email.trim().toLowerCase() && i.code.toUpperCase() === code.trim().toUpperCase());
    if (!inv) { setStatus('Invalid email or code'); return; }
    markInvitationAccepted(inv.id);
    addMembership(inv.stationId, inv.role);
    setStatus('Joined successfully');
  };

  return (
    <ScreenContainer scroll keyboardAware>
      <View className="bg-white px-6 py-4 border-b border-gray-200 -mx-6 -mt-4">
        <Text className="text-2xl font-bold text-gray-800">Accept Invitation</Text>
        <Text className="text-gray-600">Enter the email and code from your invite</Text>
      </View>
      <View className="px-6 py-4">
        {status && <View className={`border rounded-md px-3 py-2 ${status.includes('success') ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}><Text className={`${status.includes('success') ? 'text-green-700' : 'text-yellow-800'} text-sm`}>{status}</Text></View>}
        <Text className="text-gray-700 mt-4 mb-2">Email</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" className="border border-gray-300 rounded-lg px-3 py-2 bg-white" autoCapitalize="none" />
        <Text className="text-gray-700 mt-4 mb-2">Code</Text>
        <TextInput value={code} onChangeText={setCode} placeholder="ABC123" className="border border-gray-300 rounded-lg px-3 py-2 bg-white" autoCapitalize="characters" />
        <Pressable onPress={accept} className="mt-6 bg-blue-500 rounded-lg p-3"><Text className="text-center text-white font-medium">Accept</Text></Pressable>
      </View>
    </ScreenContainer>
  );
}

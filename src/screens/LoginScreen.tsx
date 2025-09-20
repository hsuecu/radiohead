import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { useAuthStore } from "../state/authStore";

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const [email, setEmail] = useState("host@example.com");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const onLogin = async () => {
    setStatus(null);
    const ok = await login(email.trim(), password);
    setStatus(ok ? "Signed in" : null);
  };

  return (
    <ScreenContainer scroll keyboardAware contentClassName="px-6 py-8">
      <Text className="text-3xl font-bold text-gray-800 mb-2">Sign in</Text>
      <Text className="text-gray-600 mb-4">Enter your email and password</Text>
      {error && <View className="bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3"><Text className="text-red-700 text-sm">{error}</Text></View>}
      {status && <View className="bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-3"><Text className="text-green-700 text-sm">{status}</Text></View>}
      <Text className="text-gray-700 mb-2">Email</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-3" autoCapitalize="none" />
      <Text className="text-gray-700 mb-2">Password</Text>
      <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry className="border border-gray-300 rounded-lg px-3 py-2 bg-white mb-6" />
      <Pressable onPress={onLogin} className="bg-blue-500 rounded-lg p-3"><Text className="text-center text-white font-medium">Sign in</Text></Pressable>
    </ScreenContainer>
  );
}

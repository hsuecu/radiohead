import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useScriptStore } from '../state/scriptStore';

import RecordingScreen from '../screens/RecordingScreen';
// import NewsScreen from '../screens/NewsScreen';
import AudioEditScreen from '../screens/AudioEditScreen';

import DashboardScreen from '../screens/DashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ExportScreen from '../screens/ExportScreen';
import AudioManagementScreen from '../screens/AudioManagementScreen';
import LoginScreen from '../screens/LoginScreen';
import { useAuthStore } from '../state/authStore';
import { BottomSheetRadioPlayer } from '../components/BottomSheetRadioPlayer';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const currentScript = useScriptStore(s => s.currentScript);
  const hasScript = !!currentScript;
  return (
    <>
      <Tab.Navigator initialRouteName="Home"
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Record') {
              iconName = focused ? 'mic' : 'mic-outline';
            } else if (route.name === 'News') {
              iconName = focused ? 'newspaper' : 'newspaper-outline';
            } else if (route.name === 'Edit') {
              iconName = focused ? 'cut' : 'cut-outline';
            } else if (route.name === 'Export') {
              iconName = focused ? 'share' : 'share-outline';
      
            } else {
              iconName = 'help-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: 'gray',
          headerShown: false,
          tabBarStyle: {
            paddingBottom: 8,
            height: 88, // Add extra height to account for mini-player
          }
        })}
      >
        <Tab.Screen name="Home" component={DashboardScreen} />
        <Tab.Screen 
          name="Record" 
          component={RecordingScreen}
          options={{ tabBarLabel: 'Content To Air', tabBarAccessibilityLabel: 'Content To Air' }}
        />
        <Tab.Screen 
          name="Edit" 
          component={AudioEditScreen}
          options={{ tabBarLabel: 'Edit Audio' }}
        />
        <Tab.Screen 
          name="Export" 
          component={AudioManagementScreen}
          options={{ tabBarLabel: 'Manage', tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'folder' : 'folder-outline'} size={size} color={color} />
          ) }}
        />
        <Tab.Screen 
          name="Autocue" 
          component={require('../screens/AutocueScreen').default}
          options={{ 
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? 'reader' : 'reader-outline'} size={size} color={color} />
            )
          }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              if (!hasScript) {
                e.preventDefault();
                navigation.navigate('Scripts');
              }
            }
          })}
        />
        <Tab.Screen 
          name="Messages" 
          component={require('../screens/MessagingScreen').default}
          options={{ 
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={size} color={color} />
            )
          }}
        />
        <Tab.Screen 
          name="Social" 
          component={require('../screens/SocialMediaScreen').default}
          options={{ 
            tabBarLabel: 'Social Media',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? 'share-social' : 'share-social-outline'} size={size} color={color} />
            )
          }}
        />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
      
      {/* Global Radio Stream Player (Compact BottomSheet) */}
      <BottomSheetRadioPlayer />
    </>
  );
}

export default function AppNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={isAuthenticated ? "Main" : "Login"}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Scripts" component={require('../screens/ScriptsScreen').default} options={{ headerShown: true, headerLargeTitle: true, title: "Scripts" }} />
            <Stack.Screen name="StationManage" component={require('../screens/StationManagementScreen').default} />
            <Stack.Screen name="PlayoutSettings" component={require('../screens/PlayoutSettingsScreen').default} />
            <Stack.Screen name="StorageSettings" component={require('../screens/StorageSettingsScreen').default} />
            <Stack.Screen name="UploadQueue" component={require('../screens/UploadQueueScreen').default} />
            <Stack.Screen name="VTLog" component={require('../screens/LogViewScreen').default} />
            <Stack.Screen name="VTRecord" component={require('../screens/VTRecorderScreen').default} />
            <Stack.Screen name="VTMix" component={require('../screens/MixScreen').default} />
            <Stack.Screen name="AcceptInvite" component={require('../screens/AcceptInvitationScreen').default} />
            <Stack.Screen name="Chat" component={require('../screens/ChatScreen').default} />
            <Stack.Screen name="DashboardConfig" component={require('../screens/DashboardConfigScreen').default} />
            <Stack.Screen name="ExportOptions" component={ExportScreen} options={{ headerShown: true, headerLargeTitle: true, title: "Export & Share" }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
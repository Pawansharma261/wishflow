import { Tabs } from 'expo-router';
import { Sparkles, Users, Calendar, Settings, Gift } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ec4899',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1740',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.08)',
          height: 68,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <Sparkles size={22} color={color} /> }} />
      <Tabs.Screen name="contacts" options={{ title: 'Contacts', tabBarIcon: ({ color }) => <Users size={22} color={color} /> }} />
      <Tabs.Screen name="scheduler" options={{ title: 'Schedule', tabBarIcon: ({ color }) => <Calendar size={22} color={color} /> }} />
      <Tabs.Screen name="wishes" options={{ title: 'Timeline', tabBarIcon: ({ color }) => <Gift size={22} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Settings size={22} color={color} /> }} />
    </Tabs>
  );
}

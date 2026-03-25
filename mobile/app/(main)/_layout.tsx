import { Tabs } from 'expo-router';
import { Sparkles, Users, Calendar, Settings, Gift } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs 
      screenOptions={{ 
        tabBarActiveTintColor: '#6d28d9',
        tabBarInactiveTintColor: '#9ca3af',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f3f4f6',
          height: 60,
          paddingBottom: 10,
          paddingTop: 5,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <Sparkles size={24} color={color} /> }} />
      <Tabs.Screen name="contacts" options={{ title: 'Contacts', tabBarIcon: ({ color }) => <Users size={24} color={color} /> }} />
      <Tabs.Screen name="scheduler" options={{ title: 'Schedule', tabBarIcon: ({ color }) => <Calendar size={24} color={color} /> }} />
      <Tabs.Screen name="wishes" options={{ title: 'My Wishes', tabBarIcon: ({ color }) => <Gift size={24} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Settings size={24} color={color} /> }} />
    </Tabs>
  );
}

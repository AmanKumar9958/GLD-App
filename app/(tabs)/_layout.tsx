import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#007BFF', headerShown: false }}>
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Home',
          // tabBarIcon: () => <Icon name="home" /> (Icon baad mein add kar lenge)
        }} 
      />
      <Tabs.Screen 
        name="courses" 
        options={{ 
          title: 'My Courses' 
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: 'Profile' 
        }} 
      />
    </Tabs>
  );
}
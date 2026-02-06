import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, SafeAreaView, Text } from 'react-native';
import { colors } from '@docstruc/theme';
import { LoginForm, Button } from '@docstruc/ui';
import { supabase } from './src/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProjectDetailScreen } from './src/screens/ProjectDetailScreen';
import { RoomDetailScreen } from './src/screens/RoomDetailScreen';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, asyncStoragePersister } from './src/lib/queryClient';

export type RootStackParamList = {
  Home: undefined;
  ProjectDetail: { projectId: string };
  RoomDetail: { room: any; projectId: string; canCreateTask?: boolean };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (email: string, pass: string) => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleRegister = async (email: string, pass: string) => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ 
      email, 
      password: pass,
      options: { data: { first_name: 'Mobile', last_name: 'User' } }
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <LoginForm 
            onLogin={handleLogin} 
            onRegister={handleRegister} 
            isLoading={loading}
            error={error}
          />
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background }
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ 
            title: 'Meine Projekte',
            headerRight: () => (
              <Button variant="outline" onClick={() => supabase.auth.signOut()} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
                 Logout
              </Button>
            )
          }}
        />
        <Stack.Screen 
          name="ProjectDetail" 
          component={ProjectDetailScreen} 
          options={{ title: 'Projekt Details' }}
        />
        <Stack.Screen 
          name="RoomDetail" 
          component={RoomDetailScreen} 
          options={{ title: 'Raum Details', presentation: 'modal' }}
        />
      </Stack.Navigator>
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  }
});

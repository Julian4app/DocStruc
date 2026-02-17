import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, SafeAreaView, Text } from 'react-native';
import { colors } from '@docstruc/theme';
import { Button, RegisterData } from '@docstruc/ui';
import { Input } from '@docstruc/ui';
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

  const handleRegister = async (data: RegisterData) => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ 
      email: data.email, 
      password: data.password,
      options: { 
        data: { 
          first_name: data.firstName, 
          last_name: data.lastName,
          phone: data.phone || null,
          company_name: data.companyName || null,
          position: data.position || null,
        } 
      }
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  if (!session) {
    const handleSubmit = async () => {
      if (isLogin) {
        await handleLogin(email, password);
      } else {
        await handleRegister({
          email,
          password,
          firstName,
          lastName,
        });
      }
    };

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={{ width: '100%', maxWidth: 400, padding: 24, backgroundColor: '#fff', borderRadius: 20 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', textAlign: 'center', color: colors.primary, marginBottom: 24 }}>
              {isLogin ? 'Anmelden' : 'Registrieren'}
            </Text>
            {error && (
              <View style={{ padding: 12, backgroundColor: '#fef2f2', borderRadius: 10, marginBottom: 16 }}>
                <Text style={{ color: '#dc2626', fontSize: 14 }}>{error}</Text>
              </View>
            )}
            {!isLogin && (
              <>
                <Input label="Vorname *" value={firstName} onChangeText={setFirstName} placeholder="Max" />
                <Input label="Nachname *" value={lastName} onChangeText={setLastName} placeholder="Mustermann" />
              </>
            )}
            <Input label="E-Mail *" value={email} onChangeText={setEmail} placeholder="name@firma.de" />
            <Input label="Passwort *" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
            <View style={{ marginTop: 16 }}>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Bitte warten...' : isLogin ? 'Anmelden' : 'Registrieren'}
              </Button>
            </View>
            <View style={{ marginTop: 16, alignItems: 'center' }}>
              <Button variant="ghost" onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Konto erstellen' : 'Zur Anmeldung'}
              </Button>
            </View>
          </View>
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

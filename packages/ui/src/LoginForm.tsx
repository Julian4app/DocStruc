import * as React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Button } from "./Button";
import { Input } from "./Input";
import { colors, spacing } from "@docstruc/theme";

export interface AuthProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onRegister: (email: string, pass: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export function LoginForm({ onLogin, onRegister, isLoading, error }: AuthProps) {
  const [isLogin, setIsLogin] = React.useState(true);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const handleSubmit = async () => {
    if (isLogin) {
      await onLogin(email, password);
    } else {
      await onRegister(email, password);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLogin ? "Willkommen zurück" : "Konto erstellen"}</Text>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Input
        label="E-Mail"
        value={email}
        onChangeText={setEmail}
        placeholder="name@firma.de"
      />
      
      <Input
        label="Passwort"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
      />

      <View style={styles.spacer} />

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Button onClick={handleSubmit}>
          {isLogin ? "Anmelden" : "Registrieren"}
        </Button>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {isLogin ? "Noch kein Konto? " : "Bereits registriert? "}
        </Text>
        <Button 
          variant="outline" 
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? "Registrieren" : "Anmelden"}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 420,
    padding: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 32,
    textAlign: 'center',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  spacer: {
    height: spacing.m,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  errorContainer: {
    marginBottom: spacing.m,
    padding: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  }
});

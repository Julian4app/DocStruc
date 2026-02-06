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
    maxWidth: 400,
    padding: spacing.l,
    backgroundColor: colors.surface,
    borderRadius: 16,
    // Shadow for web/ios
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // for android
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.l,
    textAlign: 'center',
    color: colors.text,
  },
  spacer: {
    height: spacing.m,
  },
  footer: {
    marginTop: spacing.l,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10
  },
  footerText: {
    color: colors.textSecondary,
  },
  errorContainer: {
    marginBottom: spacing.m,
    padding: spacing.s,
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
  }
});

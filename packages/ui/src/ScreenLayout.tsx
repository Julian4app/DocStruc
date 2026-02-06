import * as React from "react";
import { View, StyleSheet, ScrollView, Platform, SafeAreaView } from "react-native";
import { colors, spacing } from "@docstruc/theme";

interface ScreenLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  maxWidth?: number;
}

export function ScreenLayout({ children, header, maxWidth = 1200 }: ScreenLayoutProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {header && <View style={styles.headerContainer}>{header}</View>}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer,
            maxWidth ? { maxWidth, alignSelf: 'center', width: '100%' } : {}
          ]}
        >
          {children}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.m,
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.m,
  }
});

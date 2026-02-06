// Re-export everything from react-native-web
export * from 'react-native-web';

// Mock TurboModuleRegistry
export const TurboModuleRegistry = {
  getEnforcing: (name) => {
    console.warn(`TurboModuleRegistry.getEnforcing("${name}") called on web`);
    return null;
  },
  get: (name) => {
    console.warn(`TurboModuleRegistry.get("${name}") called on web`);
    return null;
  }
};

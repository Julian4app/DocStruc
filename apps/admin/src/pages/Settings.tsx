import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Settings() {
    return (
        <View style={styles.container}>
             <Text style={styles.text}>Settings</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 16,
        margin: 24,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12
    },
    text: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a'
    }
});

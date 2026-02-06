import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Subscriptions() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Subscriptions Page</Text>
            <Text style={styles.subText}>Full functionality coming soon.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 24,
        backgroundColor: 'white',
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
    },
    subText: {
        marginTop: 8,
        color: '#64748b'
    }
});

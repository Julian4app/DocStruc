import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RoomDetailView } from '@docstruc/ui';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { colors } from '@docstruc/theme';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'RoomDetail'>;

export function RoomDetailScreen({ route, navigation }: Props) {
  const { room, projectId, canCreateTask } = route.params;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <RoomDetailView 
        room={room} 
        projectId={projectId}
        onClose={() => navigation.goBack()}
        canCreateTask={canCreateTask}
        client={supabase}
      />
    </SafeAreaView>
  );
}

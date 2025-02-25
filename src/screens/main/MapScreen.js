import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapView } from '../../components/map';

export const MapScreen = () => {
  return (
    <SafeAreaView edges={['left', 'right']} style={styles.container}>
      <View style={styles.container}>
        <MapView />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

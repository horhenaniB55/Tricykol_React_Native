import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../constants";
import { AppBar } from "../../components/common";

export const MenuScreen = () => {
  return (
    <SafeAreaView edges={['top','left', 'right']} style={styles.safeArea}>
      <AppBar />
      <View style={styles.content}>
        <Text style={styles.text}>Menu Screen</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    color: COLORS.TEXT,
  },
});

import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";
import { colors } from "@/theme/colors";

interface FABProps {
  onPress: () => void;
  icon?: string;
  style?: ViewStyle;
}

export function FAB({ onPress, icon = "+", style }: FABProps) {
  return (
    <TouchableOpacity style={[styles.fab, style]} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.icon}>{icon}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  icon: { color: "#fff", fontSize: 28, fontWeight: "300", marginTop: -2 },
});

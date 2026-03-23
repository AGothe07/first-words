import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import { colors } from "@/theme/colors";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "ghost" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === "primary" && styles.primary,
        variant === "outline" && styles.outline,
        variant === "ghost" && styles.ghost,
        variant === "destructive" && styles.destructive,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" ? colors.primary : "#fff"} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              variant === "outline" && styles.outlineText,
              variant === "ghost" && styles.ghostText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  primary: { backgroundColor: colors.primary },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghost: { backgroundColor: "transparent" },
  destructive: { backgroundColor: colors.destructive },
  disabled: { opacity: 0.5 },
  text: { color: "#fff", fontSize: 14, fontWeight: "600" },
  outlineText: { color: colors.primary },
  ghostText: { color: colors.primary },
});

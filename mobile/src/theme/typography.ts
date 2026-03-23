import { StyleSheet } from "react-native";

export const typography = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: "600" },
  body: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: "400", lineHeight: 16 },
  caption: { fontSize: 10, fontWeight: "400", lineHeight: 14 },
  label: { fontSize: 12, fontWeight: "500" },
  button: { fontSize: 14, fontWeight: "600" },
  kpiValue: { fontSize: 22, fontWeight: "700" },
  kpiLabel: { fontSize: 11, fontWeight: "400" },
});

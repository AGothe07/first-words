import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

interface Option {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
}

export function Select({ label, placeholder, options, value, onValueChange, error }: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={[styles.trigger, error && styles.triggerError]} onPress={() => setOpen(true)}>
        <Text style={[styles.triggerText, !selected && { color: colors.textMuted }]}>
          {selected?.label || placeholder || "Selecione..."}
        </Text>
        <Text style={{ color: colors.textMuted }}>▼</Text>
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.dropdown}>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item.value === value && styles.optionActive]}
                  onPress={() => { onValueChange(item.value); setOpen(false); }}
                >
                  <Text style={[typography.body, { color: item.value === value ? colors.primary : colors.text }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "500", color: colors.textSecondary, marginBottom: 4 },
  trigger: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  triggerError: { borderColor: colors.destructive },
  triggerText: { fontSize: 14, color: colors.text },
  overlay: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)", padding: 40 },
  dropdown: { backgroundColor: colors.background, borderRadius: 12, maxHeight: 300, padding: 8 },
  option: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  optionActive: { backgroundColor: colors.primary + "15" },
  error: { fontSize: 11, color: colors.destructive, marginTop: 4 },
});

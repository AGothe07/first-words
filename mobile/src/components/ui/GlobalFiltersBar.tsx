import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useFilters } from "@/contexts/FiltersContext";
import { colors } from "@/theme/colors";
import { Select } from "@/components/ui/Select";
import { dashboardBlueprint } from "@/config/dashboardBlueprint";

const types: { label: string; value: "all" | "income" | "expense" }[] = [
  { label: "Todos", value: "all" },
  { label: "Receitas", value: "income" },
  { label: "Despesas", value: "expense" },
];

export function GlobalFiltersBar() {
  const {
    filters,
    setPreset,
    setType,
    setCategoryId,
    setPersonId,
    setSubcategoryId,
    setPaymentMethodId,
    setAccountId,
    setProjectId,
    clearAllFilters,
    data,
    isDimensionActive,
  } = useFilters();

  const hasAnyFilter = Boolean(
    filters.type !== "all" ||
    filters.preset !== "month" ||
    filters.categoryId ||
    filters.personId ||
    filters.subcategoryId ||
    filters.paymentMethodId ||
    filters.accountId ||
    filters.projectId
  );

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {dashboardBlueprint.filterPresets.map((preset) => (
          <TouchableOpacity
            key={preset.value}
            style={[styles.chip, filters.preset === preset.value && styles.chipActive]}
            onPress={() => setPreset(preset.value)}
          >
            <Text style={[styles.chipText, filters.preset === preset.value && styles.chipTextActive]}>
              {preset.label}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.separator} />
        {types.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.chip, filters.type === t.value && styles.chipActive]}
            onPress={() => setType(t.value)}
          >
            <Text style={[styles.chipText, filters.type === t.value && styles.chipTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.advancedFilters}>
        <Select
          label="Categoria"
          value={filters.categoryId || ""}
          options={[{ label: "Todas", value: "" }, ...data.categories.map((c) => ({ label: c.name, value: c.id }))]}
          onValueChange={(value) => setCategoryId(value || null)}
        />
        <Select
          label="Pessoa"
          value={filters.personId || ""}
          options={[{ label: "Todas", value: "" }, ...data.persons.map((p) => ({ label: p.name, value: p.id }))]}
          onValueChange={(value) => setPersonId(value || null)}
        />
        <Select
          label="Subcategoria"
          value={filters.subcategoryId || ""}
          options={[{ label: "Todas", value: "" }, ...data.subcategories.map((s) => ({ label: s.name, value: s.id }))]}
          onValueChange={(value) => setSubcategoryId(value || null)}
        />

        {isDimensionActive("payment_method") && (
          <Select
            label="Forma de Pagamento"
            value={filters.paymentMethodId || ""}
            options={[{ label: "Todas", value: "" }, ...data.paymentMethods.map((p) => ({ label: p.name, value: p.id }))]}
            onValueChange={(value) => setPaymentMethodId(value || null)}
          />
        )}

        {isDimensionActive("account") && (
          <Select
            label="Conta"
            value={filters.accountId || ""}
            options={[{ label: "Todas", value: "" }, ...data.accounts.map((a) => ({ label: a.name, value: a.id }))]}
            onValueChange={(value) => setAccountId(value || null)}
          />
        )}

        {isDimensionActive("project") && (
          <Select
            label="Projeto"
            value={filters.projectId || ""}
            options={[{ label: "Todos", value: "" }, ...data.projects.map((p) => ({ label: p.name, value: p.id }))]}
            onValueChange={(value) => setProjectId(value || null)}
          />
        )}
      </View>

      {hasAnyFilter && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { marginTop: 6 }]}>
          {filters.categoryId && (
            <TouchableOpacity style={styles.filterTag} onPress={() => setCategoryId(null)}>
              <Text style={styles.filterTagText}>
                📂 {data.categories.find((c) => c.id === filters.categoryId)?.name || "?"} ✕
              </Text>
            </TouchableOpacity>
          )}
          {filters.personId && (
            <TouchableOpacity style={styles.filterTag} onPress={() => setPersonId(null)}>
              <Text style={styles.filterTagText}>
                👤 {data.persons.find((p) => p.id === filters.personId)?.name || "?"} ✕
              </Text>
            </TouchableOpacity>
          )}
          {filters.subcategoryId && (
            <TouchableOpacity style={styles.filterTag} onPress={() => setSubcategoryId(null)}>
              <Text style={styles.filterTagText}>
                🧩 {data.subcategories.find((s) => s.id === filters.subcategoryId)?.name || "?"} ✕
              </Text>
            </TouchableOpacity>
          )}
          {filters.paymentMethodId && (
            <TouchableOpacity style={styles.filterTag} onPress={() => setPaymentMethodId(null)}>
              <Text style={styles.filterTagText}>
                💳 {data.paymentMethods.find((p) => p.id === filters.paymentMethodId)?.name || "?"} ✕
              </Text>
            </TouchableOpacity>
          )}
          {filters.accountId && (
            <TouchableOpacity style={styles.filterTag} onPress={() => setAccountId(null)}>
              <Text style={styles.filterTagText}>
                🏦 {data.accounts.find((a) => a.id === filters.accountId)?.name || "?"} ✕
              </Text>
            </TouchableOpacity>
          )}
          {filters.projectId && (
            <TouchableOpacity style={styles.filterTag} onPress={() => setProjectId(null)}>
              <Text style={styles.filterTagText}>
                📌 {data.projects.find((p) => p.id === filters.projectId)?.name || "?"} ✕
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.filterTag, styles.clearTag]} onPress={clearAllFilters}>
            <Text style={styles.clearTagText}>Limpar filtros</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  advancedFilters: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  row: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: "#fff",
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  filterTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: `${colors.primary}15`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  filterTagText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "500",
  },
  clearTag: {
    backgroundColor: `${colors.destructive}15`,
    borderColor: `${colors.destructive}35`,
  },
  clearTagText: {
    fontSize: 11,
    color: colors.destructive,
    fontWeight: "600",
  },
});

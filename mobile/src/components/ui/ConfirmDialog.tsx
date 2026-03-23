import { Alert } from "react-native";

export function confirmDelete(title: string, onConfirm: () => void) {
  Alert.alert(
    "Confirmar exclusão",
    `Deseja realmente excluir "${title}"?`,
    [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: onConfirm },
    ]
  );
}

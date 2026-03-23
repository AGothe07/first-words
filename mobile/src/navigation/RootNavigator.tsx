import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { Loading } from "@/components/ui/Loading";
import AppNavigator from "@/navigation/AppNavigator";
import AuthNavigator from "@/navigation/AuthNavigator";

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

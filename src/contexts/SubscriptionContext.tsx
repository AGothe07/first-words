import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Subscription {
  id: string;
  user_id: string;
  plan_type: string;
  status: string;
  value: number;
  access_expires_at: string | null;
  trial_ends_at: string | null;
  trial_used: boolean;
  cancelled_at: string | null;
  manual_access_expires_at: string | null;
  started_at: string | null;
  customer_email: string | null;
}

interface SubscriptionPayment {
  id: string;
  amount: number;
  status: string;
  billing_type: string | null;
  due_date: string | null;
  confirmed_at: string | null;
  created_at: string;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  payments: SubscriptionPayment[];
  loading: boolean;
  hasValidAccess: boolean;
  hasNoSubscription: boolean;
  isActive: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  isExpired: boolean;
  isCancelled: boolean;
  isOverdue: boolean;
  isReadOnly: boolean;
  daysRemaining: number;
  hasManualAccess: boolean;
  refreshSubscription: () => Promise<void>;
  cancelSubscription: () => Promise<{ error: string | null }>;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!session?.access_token) {
      setSubscription(null);
      setPayments([]);
      setLoading(false);
      return;
    }

    try {
      const res = await supabase.functions.invoke("asaas-get-subscription", {
        method: "POST",
      });

      if (res.data) {
        setSubscription(res.data.subscription || null);
        setPayments(res.data.payments || []);
      }
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Realtime listener
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("subscription-changes")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => fetchSubscription()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSubscription]);

  const now = new Date();

  const isTrialActive = subscription?.status === "trial_active" &&
    !!subscription?.trial_ends_at &&
    new Date(subscription.trial_ends_at) > now;

  const isTrialExpired = subscription?.status === "trial_active" &&
    !!subscription?.trial_ends_at &&
    new Date(subscription.trial_ends_at) <= now;

  const isActive = subscription?.status === "active" &&
    !!subscription?.access_expires_at &&
    new Date(subscription.access_expires_at) > now;

  const isExpired = subscription?.status === "active" &&
    !!subscription?.access_expires_at &&
    new Date(subscription.access_expires_at) <= now;

  const isCancelled = !!subscription?.cancelled_at;

  const isOverdue = subscription?.status === "overdue";

  const hasManualAccess = !!subscription?.manual_access_expires_at &&
    new Date(subscription.manual_access_expires_at) > now;

  const hasNoSubscription = !loading && !subscription;
  const hasValidAccess = isActive || isTrialActive || hasManualAccess;

  // Read-only: user has a subscription but it's expired/overdue/trial expired
  // They can still view data but cannot create/edit
  const isReadOnly = !loading && !hasValidAccess && !hasNoSubscription;

  const daysRemaining = (() => {
    const expiresAt = subscription?.access_expires_at || subscription?.trial_ends_at;
    if (!expiresAt) return 0;
    const diff = new Date(expiresAt).getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const cancelSubscription = async () => {
    try {
      const res = await supabase.functions.invoke("asaas-cancel-subscription", {
        method: "POST",
      });
      if (res.error) return { error: res.error.message };
      await fetchSubscription();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Erro ao cancelar" };
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        payments,
        loading,
        hasValidAccess,
        hasNoSubscription,
        isActive,
        isTrialActive,
        isTrialExpired,
        isExpired,
        isCancelled,
        isOverdue,
        isReadOnly,
        daysRemaining,
        hasManualAccess,
        refreshSubscription: fetchSubscription,
        cancelSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}

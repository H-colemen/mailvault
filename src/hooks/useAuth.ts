import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/providers/trpc";
import type { Session } from "@supabase/supabase-js";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: "user" | "admin";
};

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/login" } =
    options ?? {};

  const navigate = useNavigate();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);

  const utils = trpc.useUtils();

  // Query user data from tRPC (which validates the Supabase token)
  const {
    data: trpcUser,
    isLoading: isTrpcLoading,
    error,
    refetch,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
    enabled: sessionChecked,
  });

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSupabaseSession(session);
      setSessionChecked(true);
      
      if (session) {
        // Refresh the tRPC user data
        refetch();
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSupabaseSession(session);
        if (session) {
          refetch();
        } else {
          utils.auth.me.invalidate();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [refetch, utils]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await supabase.auth.signOut();
      await utils.invalidate();
      navigate(redirectPath);
    },
  });

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    logoutMutation.mutate();
  }, [logoutMutation]);

  const user: AuthUser | null = trpcUser
    ? {
        id: trpcUser.id,
        email: trpcUser.email,
        name: trpcUser.name,
        avatar: trpcUser.avatar,
        role: trpcUser.role as "user" | "admin",
      }
    : null;

  const isLoading = isTrpcLoading || !sessionChecked;

  useEffect(() => {
    if (redirectOnUnauthenticated && !isLoading && !user) {
      const currentPath = window.location.pathname;
      if (currentPath !== redirectPath) {
        navigate(redirectPath);
      }
    }
  }, [redirectOnUnauthenticated, isLoading, user, navigate, redirectPath]);

  return useMemo(
    () => ({
      user,
      isAuthenticated: !!user || !!supabaseSession,
      isAdmin: user?.role === "admin",
      isLoading: isLoading || logoutMutation.isPending,
      error,
      logout,
      refresh: refetch,
    }),
    [user, supabaseSession, isLoading, logoutMutation.isPending, error, logout, refetch],
  );
}

import { createServerClient, createAdminClient } from "../lib/supabase";
import type { User } from "@db/schema";

export async function authenticateRequest(headers: Headers): Promise<User | undefined> {
  const authHeader = headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authHeader.slice(7);
  
  try {
    const supabase = createServerClient();
    const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
    
    if (error || !authUser) {
      return undefined;
    }

    // Get or create user in our database
    const adminClient = createAdminClient();
    const { data: dbUser, error: dbError } = await adminClient
      .from("users")
      .select("*")
      .eq("email", authUser.email)
      .single();

    if (dbError || !dbUser) {
      // Create user in our database
      const { data: newUser, error: insertError } = await adminClient
        .from("users")
        .insert({
          email: authUser.email!,
          name: authUser.user_metadata?.name || authUser.email!.split("@")[0],
          avatar: authUser.user_metadata?.avatar_url,
          last_sign_in_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("[auth] Failed to create user:", insertError);
        return undefined;
      }

      // Create default settings for the user
      await adminClient.from("settings").insert({
        userId: newUser.id,
      });

      return newUser as User;
    }

    // Update last sign in
    await adminClient
      .from("users")
      .update({ last_sign_in_at: new Date().toISOString() })
      .eq("id", dbUser.id);

    return dbUser as User;
  } catch (error) {
    console.error("[auth] Authentication error:", error);
    return undefined;
  }
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !data) {
      return undefined;
    }

    return data as User;
  } catch {
    return undefined;
  }
}

export async function createUser(data: {
  email: string;
  name?: string;
  avatar?: string;
  role?: string;
}): Promise<User | undefined> {
  try {
    const adminClient = createAdminClient();
    const { data: user, error } = await adminClient
      .from("users")
      .insert({
        email: data.email,
        name: data.name,
        avatar: data.avatar,
        role: data.role || "user",
        last_sign_in_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[auth] Failed to create user:", error);
      return undefined;
    }

    // Create default settings
    await adminClient.from("settings").insert({
      userId: user.id,
    });

    return user as User;
  } catch (error) {
    console.error("[auth] Create user error:", error);
    return undefined;
  }
}

import { z } from "zod";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { createAdminClient } from "./lib/supabase";

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),

  login: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
      }),
    )
    .mutation(async ({ input }) => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        token: data.session?.access_token,
        user: data.user,
      };
    }),

  register: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const supabase = createAdminClient();
      
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            name: input.name || input.email.split("@")[0],
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        token: data.session?.access_token,
        user: data.user,
      };
    }),

  logout: authedQuery.mutation(async () => {
    const supabase = createAdminClient();
    await supabase.auth.signOut();
    return { success: true };
  }),

  refresh: publicQuery
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.auth.getUser(input.token);

      if (error || !data.user) {
        throw new Error("Invalid token");
      }

      return { user: data.user };
    }),
});

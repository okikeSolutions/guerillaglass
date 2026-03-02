import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Demo query used by the landing-app Convex route to verify realtime wiring.
 */
export const listNumbers = query({
  args: {
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const numbers = await ctx.db.query("numbers").order("desc").take(args.count);

    return {
      viewer: (await ctx.auth.getUserIdentity())?.name ?? null,
      numbers: numbers.reverse().map((number) => number.value),
    };
  },
});

/**
 * Demo mutation used by the landing-app Convex route for shared state checks.
 */
export const addNumber = mutation({
  args: {
    value: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("numbers", { value: args.value });
  },
});

/**
 * Action helper used for end-to-end Convex smoke flow validation.
 */
export const myAction = action({
  args: {
    first: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(api.myFunctions.addNumber, {
      value: args.first,
    });
  },
});

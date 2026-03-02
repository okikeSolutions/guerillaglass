import { ConvexError, v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

const MAX_LIST_NUMBERS_COUNT = 100;

function normalizeListCount(requestedCount: number): number {
  const normalized = Math.trunc(requestedCount);
  if (normalized < 1) {
    return 1;
  }
  return Math.min(normalized, MAX_LIST_NUMBERS_COUNT);
}

/**
 * Demo query used by the landing-app Convex route to verify realtime wiring.
 */
export const listNumbers = query({
  args: {
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
    const count = normalizeListCount(args.count);
    const numbers = await ctx.db.query("numbers").order("desc").take(count);

    return {
      viewer: identity.name ?? null,
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
    await ctx.runMutation(api.myFunctions.addNumber, {
      value: args.first,
    });
  },
});

import { describe, expect, test } from "bun:test";
import { unresolvedReviewThreads } from "./check_pr_review_threads";

function thread(id: string, isResolved: boolean, isOutdated = false) {
  return {
    id,
    isResolved,
    isOutdated,
    path: "src/example.ts",
    line: isOutdated ? null : 12,
    comments: {
      nodes: [
        {
          author: { login: "reviewer" },
          body: "Finding",
          url: `https://example.test/${id}`,
        },
      ],
    },
  };
}

describe("pull request review-thread gate", () => {
  test("returns every unresolved thread, including outdated comments", () => {
    expect(
      unresolvedReviewThreads([
        thread("resolved", true),
        thread("active", false),
        thread("outdated", false, true),
      ]).map(({ id }) => id),
    ).toEqual(["active", "outdated"]);
  });

  test("passes only when every review thread is resolved", () => {
    expect(unresolvedReviewThreads([thread("one", true), thread("two", true)])).toEqual([]);
  });
});

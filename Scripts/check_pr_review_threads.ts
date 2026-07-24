#!/usr/bin/env bun

type ReviewComment = {
  readonly author: { readonly login: string } | null;
  readonly body: string;
  readonly url: string;
};

type ReviewThread = {
  readonly id: string;
  readonly isResolved: boolean;
  readonly isOutdated: boolean;
  readonly path: string;
  readonly line: number | null;
  readonly comments: { readonly nodes: ReadonlyArray<ReviewComment> };
};

type ReviewThreadsPage = {
  readonly data?: {
    readonly repository?: {
      readonly pullRequest?: {
        readonly reviewThreads: {
          readonly nodes: ReadonlyArray<ReviewThread>;
          readonly pageInfo: {
            readonly hasNextPage: boolean;
            readonly endCursor: string | null;
          };
        };
      } | null;
    } | null;
  };
  readonly errors?: ReadonlyArray<{ readonly message?: string }>;
};

const reviewThreadsQuery = `
  query ReviewThreads($owner: String!, $name: String!, $number: Int!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $cursor) {
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            comments(first: 20) {
              nodes {
                author { login }
                body
                url
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

function runGh(args: ReadonlyArray<string>): string {
  const result = Bun.spawnSync(["gh", ...args], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    const message = result.stderr.toString().trim() || result.stdout.toString().trim();
    throw new Error(message || `gh ${args.join(" ")} failed with exit code ${result.exitCode}`);
  }
  return result.stdout.toString().trim();
}

export function unresolvedReviewThreads(
  threads: ReadonlyArray<ReviewThread>,
): ReadonlyArray<ReviewThread> {
  return threads.filter((thread) => !thread.isResolved);
}

function parsePullRequestNumber(rawValue: string): number {
  const number = Number.parseInt(rawValue, 10);
  if (!Number.isSafeInteger(number) || number <= 0 || String(number) !== rawValue.trim()) {
    throw new Error(`Invalid pull request number: ${rawValue}`);
  }
  return number;
}

export function collectReviewThreadPages(
  number: number,
  fetchPage: (cursor: string | null) => ReviewThreadsPage,
): ReviewThread[] {
  const threads: ReviewThread[] = [];
  let cursor: string | null = null;

  do {
    const response = fetchPage(cursor);
    if (response.errors?.length) {
      throw new Error(
        `GitHub GraphQL error: ${response.errors.map((error) => error.message ?? "unknown error").join("; ")}`,
      );
    }
    const pullRequest = response.data?.repository?.pullRequest;
    if (!pullRequest) {
      throw new Error(`Pull request #${number} was not found.`);
    }
    const page = pullRequest.reviewThreads;
    threads.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    if (page.pageInfo.hasNextPage && !cursor) {
      throw new Error("GitHub reported another review-thread page without an end cursor.");
    }
  } while (cursor);

  return threads;
}

function fetchReviewThreads(owner: string, name: string, number: number): ReviewThread[] {
  return collectReviewThreadPages(number, (cursor) => {
    const args = [
      "api",
      "graphql",
      "-f",
      `query=${reviewThreadsQuery}`,
      "-F",
      `owner=${owner}`,
      "-F",
      `name=${name}`,
      "-F",
      `number=${number}`,
    ];
    if (cursor) {
      args.push("-F", `cursor=${cursor}`);
    }
    return JSON.parse(runGh(args)) as ReviewThreadsPage;
  });
}

function summarizeComment(thread: ReviewThread): string {
  const comment = thread.comments.nodes[0];
  const firstTextLine = comment?.body
    .replaceAll(/<[^>]+>/gu, " ")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  const location = `${thread.path}${thread.line === null ? "" : `:${thread.line}`}`;
  const status = thread.isOutdated ? "outdated, unresolved" : "unresolved";
  return `- ${location} (${status}) by @${comment?.author?.login ?? "unknown"}: ${firstTextLine ?? "review comment"}\n  ${comment?.url ?? thread.id}`;
}

function main(): void {
  const repository = runGh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  const [owner, name] = repository.split("/", 2);
  if (!owner || !name) {
    throw new Error(`Unable to determine GitHub repository from: ${repository}`);
  }

  const rawNumber = process.argv[2] ?? runGh(["pr", "view", "--json", "number", "--jq", ".number"]);
  const number = parsePullRequestNumber(rawNumber);
  const threads = fetchReviewThreads(owner, name, number);
  const unresolved = unresolvedReviewThreads(threads);

  if (unresolved.length > 0) {
    console.error(`Pull request #${number} has ${unresolved.length} unresolved review thread(s):`);
    for (const thread of unresolved) {
      console.error(summarizeComment(thread));
    }
    console.error(
      "Address each comment, reply with validation evidence, resolve its thread, then rerun this check before merging.",
    );
    process.exit(1);
  }

  console.log(
    `Pull request #${number} has zero unresolved review threads (${threads.length} total).`,
  );
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

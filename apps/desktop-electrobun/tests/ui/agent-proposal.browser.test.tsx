import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { Schema } from "effect";
import {
  EditStoryboard,
  type EditProposalBaseline,
} from "@guerillaglass/engine-contract/domains/editWorkflow";
import { AgentProposalReview } from "../../src/mainview/app/studio/panels/AgentProposalPanel";
import { setLocale } from "../../src/paraglide/runtime";

const storyboard = Schema.decodeUnknownSync(EditStoryboard)({
  version: 1,
  id: "demo",
  baseRevision: "a".repeat(64),
  sourceRevision: "b".repeat(64),
  brief: "Show result first.",
  scenes: [
    {
      title: "Result",
      purpose: "Lead with the outcome",
      item: {
        kind: "clip",
        id: "result",
        sourceAssetId: "recording",
        sourceStartSeconds: 6,
        sourceEndSeconds: 7,
      },
    },
  ],
});
const baseline: EditProposalBaseline = {
  revision: storyboard.baseRevision,
  timeline: { version: 2, items: [] },
};
let root: Root | undefined;
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

async function mount(
  options: {
    dirty?: boolean;
    validate?: () => Promise<EditProposalBaseline>;
    preview?: boolean;
  } = {},
) {
  setLocale("en-US", { reload: false });
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const apply = vi.fn(async () => {});
  const validate = vi.fn(options.validate ?? (async () => baseline));
  const props = {
    available: true,
    busy: false,
    dirty: options.dirty ?? false,
    editorSignature: "initial",
    validate,
    apply,
    ...(options.preview ? { renderScenePreview: () => <div>Isolated preview fixture</div> } : {}),
  };
  await act(async () => root?.render(<AgentProposalReview {...props} />));
  await page.getByRole("button", { name: "Agent proposal", exact: true }).click();
  await page.getByRole("textbox", { name: "Storyboard JSON" }).fill(JSON.stringify(storyboard));
  return { props, apply, validate };
}

test("shows intent and differences, requires validation plus explicit confirmation, then saves", async () => {
  const { apply, validate } = await mount();
  await page.getByRole("button", { name: "Validate proposal", exact: true }).click();
  await expect.element(page.getByText("Source and saved revision validated.")).toBeVisible();
  await expect.element(page.getByText("Lead with the outcome")).toBeVisible();
  await expect.element(page.getByText("Added", { exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Apply and save proposal" }))
    .toBeDisabled();
  expect(apply).not.toHaveBeenCalled();
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Apply and save proposal" }).click();
  await expect
    .element(
      page.getByText("Proposal applied and saved. Review it in the timeline before exporting."),
    )
    .toBeVisible();
  expect(validate).toHaveBeenCalledWith(storyboard);
  expect(apply).toHaveBeenCalledExactlyOnceWith(storyboard);
});

test("an editor change invalidates a reviewed proposal even after confirmation", async () => {
  const { props, apply } = await mount();
  await page.getByRole("button", { name: "Validate proposal", exact: true }).click();
  await expect.element(page.getByText("Source and saved revision validated.")).toBeVisible();
  await page.getByRole("checkbox").click();
  await act(async () => root?.render(<AgentProposalReview {...props} editorSignature="changed" />));
  await expect
    .element(page.getByText("The project or proposal changed. Validate again before applying."))
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Apply and save proposal" }))
    .toBeDisabled();
  expect(apply).not.toHaveBeenCalled();
});

test("invalid JSON and native validation errors cannot apply", async () => {
  const { apply, validate } = await mount({
    validate: async () => {
      throw new Error("project_mismatch");
    },
  });
  await page.getByRole("textbox", { name: "Storyboard JSON" }).fill("{}");
  await page.getByRole("button", { name: "Validate proposal", exact: true }).click();
  await expect
    .element(page.getByText("Missing required field: version. Add it and validate again."))
    .toBeVisible();
  expect(validate).not.toHaveBeenCalled();
  await page.getByRole("textbox", { name: "Storyboard JSON" }).fill(JSON.stringify(storyboard));
  await page.getByRole("button", { name: "Validate proposal", exact: true }).click();
  await expect
    .element(
      page.getByText(
        "Validation failed. Check source ranges and revisions, then prepare a fresh proposal.",
      ),
    )
    .toBeVisible();
  expect(apply).not.toHaveBeenCalled();
});

test("unsaved edits block proposal validation", async () => {
  const { validate } = await mount({ dirty: true });
  await expect
    .element(page.getByText("Save your current edits before validating a proposal."))
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Validate proposal", exact: true }))
    .toBeDisabled();
  expect(validate).not.toHaveBeenCalled();
});

test("scene preview names the selected scene and version and receives keyboard focus", async () => {
  await mount({ preview: true });
  await page.getByRole("button", { name: "Validate proposal", exact: true }).click();
  await page.getByRole("button", { name: "Preview scene", exact: true }).click();
  await expect
    .element(page.getByRole("heading", { name: "Result · Proposed", exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Preview scene", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => document.activeElement?.getAttribute("aria-label"))
    .toBe("Result · Proposed");
});

for (const [value, message] of [
  ["{", "Invalid JSON. Fix the JSON syntax before validating again."],
  [
    JSON.stringify({ ...storyboard, version: 2 }),
    "Unsupported storyboard version. Ask your editing agent for version 1.",
  ],
  [
    JSON.stringify({ ...storyboard, scenes: [storyboard.scenes[0], storyboard.scenes[0]] }),
    "Scene 2 repeats the ID of scene 1. Give each scene a unique item.id.",
  ],
  [
    "x".repeat(2 * 1024 * 1024 + 1),
    "Storyboard exceeds the 2 MiB limit. Reduce the JSON file size and import again.",
  ],
] as const) {
  test(`storyboard diagnostics explain ${message}`, async () => {
    const { validate, apply } = await mount();
    await page.getByRole("textbox", { name: "Storyboard JSON" }).fill(value);
    await page.getByRole("button", { name: "Validate proposal", exact: true }).click();
    await expect.element(page.getByText(message, { exact: true })).toBeVisible();
    expect(validate).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });
}

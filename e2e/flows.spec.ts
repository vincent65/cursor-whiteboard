import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { loadScenario } from "../src/server/fake/scenario.js";
import { FileStore } from "../src/server/files.js";
import { TaskGraph } from "../src/shared/tasks.js";
import { expect, test } from "./fixtures.js";

const scenario = loadScenario(
  fileURLToPath(new URL("scenario.json", import.meta.url)),
);

// The demo project's recordings, by flow, as docs/demo/ names them.
const DEMO_DIR = fileURLToPath(new URL("../docs/demo/", import.meta.url));
const DEMO_NAMES: Record<string, string> = {
  "plan, ask, and accept": "01-plan-ask-accept.webm",
  "compile and split": "02-compile-split.webm",
  "launch a run": "03-launch-run.webm",
};

test.afterEach(async ({ page }, info) => {
  // Checked in every project, so a new flow cannot reach the demo without a name.
  const name = DEMO_NAMES[info.title];
  if (!name)
    throw new Error(`no DEMO_NAMES entry for the test "${info.title}"`);
  const video = page.video();
  if (!video || info.status !== info.expectedStatus) return;
  // The video is complete once its page closes.
  await page.close();
  await video.saveAs(join(DEMO_DIR, name));
});

// A drag on the board's canvas, from and to points relative to the main area.
async function drag(
  page: Page,
  from: [number, number],
  to: [number, number],
): Promise<void> {
  const box = await page.getByRole("main").boundingBox();
  if (!box) throw new Error("the main area is not on screen");
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 12 });
  await page.mouse.up();
}

type Element = {
  isDeleted?: boolean;
  text?: string;
  originalText?: string;
  customData?: Record<string, unknown>;
};
const boardElements = (root: string, name: string): Element[] =>
  JSON.parse(
    readFileSync(
      join(root, ".blueprint", "boards", `${name}.excalidraw.json`),
      "utf8",
    ),
  ).elements;

test("plan, ask, and accept", async ({ page, start }) => {
  const app = await start();
  await page.goto(app.url);
  // The welcome page's button opens the sidebar's name field.
  await page.getByRole("button", { name: "Create your first board" }).click();
  await page.getByRole("textbox", { name: "New board name" }).fill("sign-in");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/boards\/sign-in$/);

  // Right of the properties panel, which covers the board's left 232 px while a tool is
  // picked, and left of center, so the proposal drawn to their right fits in view.
  for (const x of [260, 410]) {
    // The radio's icon covers it; a user clicks the icon's label.
    await page.getByTestId("toolbar-rectangle").locator("..").click();
    await drag(page, [x, 280], [x + 110, 380]);
  }
  await page.keyboard.press("Escape");
  await drag(page, [240, 250], [550, 410]);
  await expect(page.getByText(/^2 selected:/)).toBeVisible();

  const message = page.getByRole("textbox", { name: "Message Claude" });
  await expect(message).toBeEnabled();
  await message.fill("Sketch the sign-in flow these two steps make.");
  await message.press("Enter");
  await expect(page.getByText(/Claude proposed Sign-in flow/)).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText(/Claude proposed/)).toBeHidden();

  // Accepted elements keep their origin and lose the ghost marker; each label still fits
  // its box on one line.
  const accepted = () =>
    boardElements(app.root, "sign-in").filter(
      (e) =>
        !e.isDeleted &&
        e.customData?.origin === "ai" &&
        e.customData.ghost === undefined,
    );
  await expect.poll(accepted).toHaveLength(5);
  expect(
    accepted().flatMap((e) => (e.text === undefined ? [] : [e.text])),
  ).toEqual(["Login", "Home"]);
});

test("compile and split", async ({ page, start }) => {
  const app = await start(async (root) => {
    const boards = join(root, ".blueprint", "boards");
    await mkdir(boards, { recursive: true });
    await writeFile(
      join(boards, "main.excalidraw.json"),
      JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "blueprint",
        elements: [
          {
            id: "login",
            type: "rectangle",
            x: 100,
            y: 100,
            width: 200,
            height: 80,
            boundElements: [{ id: "login-label", type: "text" }],
          },
          {
            id: "login-label",
            type: "text",
            x: 170,
            y: 127,
            width: 60,
            height: 25,
            text: "Login",
            originalText: "Login",
            fontSize: 20,
            fontFamily: 5,
            lineHeight: 1.25,
            containerId: "login",
            textAlign: "center",
            verticalAlign: "middle",
          },
        ],
        appState: {},
        files: {},
      }),
    );
  });
  await page.goto(app.url);
  await expect(page).toHaveURL(/#\/boards\/main$/);

  await page.getByRole("button", { name: "Compile" }).click();
  await expect(page.getByText(/Wrote \.blueprint\/spec\.md/)).toBeVisible();
  await page.getByRole("link", { name: "Spec" }).click();
  // The chip shows the cited box's label; its tooltip keeps the id.
  const citation = page.getByRole("link", { name: "Login" });
  await expect(citation).toHaveAttribute("title", "[[board:main#login]]");

  await citation.click();
  await expect(page).toHaveURL(/#\/boards\/main\?focus=login$/);
  await expect(page.getByText("1 selected: Login")).toBeVisible();

  await page.getByRole("link", { name: "Spec" }).click();
  // The fake splits at once, so the request waits until the test has seen the split
  // start; then the button reads Splitting… until the tasks are written.
  let release = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/agent/split", async (route) => {
    await held;
    await route.continue();
  });
  await page.getByRole("button", { name: "Split into tasks" }).click();
  await expect(page.getByRole("button", { name: "Splitting…" })).toBeDisabled();
  release();
  await expect(
    page.getByRole("button", { name: "Split into tasks" }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Tasks" }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Build the Login page" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Build the Home page" }),
  ).toBeVisible();
});

test("launch a run", async ({ page, start }) => {
  const { tasks } = TaskGraph.parse(scenario.split);
  // The split's own tasks, written as the split writes them.
  const app = await start(async (root) => {
    const store = new FileStore(root);
    await store.init();
    await store.replaceTasks(tasks);
  });
  await page.goto(`${app.url}/#/tasks`);

  const first = page.getByRole("article").first();
  await expect(first).toContainText("Build the Login page");
  await first.getByRole("button", { name: "Launch" }).click();
  await page
    .getByRole("dialog", { name: "Launch Build the Login page" })
    .getByRole("button", { name: "Launch" })
    .click();

  await expect(page).toHaveURL(/#\/sessions$/);
  const card = page.getByRole("article", { name: "login-page" });
  const status = card.getByRole("status");
  // The run writes, then asks before pushing; Working lasts only until the ask arrives,
  // so the held state is what the test waits on.
  await expect(status).toHaveText("Needs you");
  const ask = card.getByRole("alertdialog");
  await expect(ask).toContainText("Allow Bash");
  const allow = ask.getByRole("button", { name: "Allow once" });
  await allow.hover();
  await allow.click();
  await expect(status).toHaveText("Done");
  await expect(card.getByRole("link", { name: "PR" })).toHaveAttribute(
    "href",
    "https://github.com/example/blueprint-demo/pull/1",
  );

  const worktree = join(app.root, ".blueprint", "worktrees", "login-page");
  const branch = execFileSync("git", ["branch", "--show-current"], {
    cwd: worktree,
    encoding: "utf8",
  }).trim();
  expect(branch).toBe("blueprint/login-page");
});

// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Markdown } from "../../src/ui/markdown";

const md = (text: string) => render(<Markdown text={text} />).container;

test("blank lines separate paragraphs; a single newline is a line break", () => {
  const c = md("One\ntwo\n\nThree");
  const ps = c.querySelectorAll("p");
  expect(ps).toHaveLength(2);
  expect(ps[0].innerHTML).toBe("One<br>two");
  expect(ps[1]).toHaveTextContent("Three");
});

test("headings keep their text, below the panel's own heading level", () => {
  md("# Plan\n\n### Notes ##");
  expect(screen.getByRole("heading", { name: "Plan", level: 3 })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Notes", level: 5 })).toBeTruthy();
});

test("strong, emphasis, and inline code", () => {
  const c = md("**bold** and *it* and __b2__ and _i2_ and `a *b* c`");
  expect([...c.querySelectorAll("strong")].map((e) => e.textContent)).toEqual([
    "bold",
    "b2",
  ]);
  expect([...c.querySelectorAll("em")].map((e) => e.textContent)).toEqual([
    "it",
    "i2",
  ]);
  // Code is literal: no emphasis inside it.
  expect(c.querySelector("code")).toHaveTextContent("a *b* c");
  expect(c.querySelector("code em")).toBeNull();
});

test("underscores inside a word are not emphasis", () => {
  const c = md("call snake_case_name now");
  expect(c.querySelector("em")).toBeNull();
  expect(c).toHaveTextContent("call snake_case_name now");
});

test("emphasis nests inside strong", () => {
  const c = md("**a *b* c**");
  expect(c.querySelector("strong em")).toHaveTextContent("b");
});

test("a fenced code block keeps its lines and markup as text", () => {
  const c = md("Before\n```ts\nconst a = 1;\n  **not bold**\n```\nAfter");
  const code = c.querySelector("pre code");
  expect(code?.textContent).toBe("const a = 1;\n  **not bold**");
  expect(c.querySelector("pre strong")).toBeNull();
  expect(c.querySelectorAll("p")).toHaveLength(2);
});

test("an unclosed fence runs to the end", () => {
  const c = md("```\nstill code");
  expect(c.querySelector("pre code")?.textContent).toBe("still code");
});

test("unordered and ordered lists", () => {
  const c = md("- one\n- **two**\n  more\n\n3. three\n4. four");
  const ul = c.querySelector("ul");
  expect(ul?.querySelectorAll("li")).toHaveLength(2);
  expect(ul?.querySelector("li strong")).toHaveTextContent("two");
  // A continuation line is a line break, as in a paragraph.
  expect(ul?.querySelectorAll("li")[1].innerHTML).toBe(
    "<strong>two</strong><br>more",
  );
  const ol = c.querySelector("ol");
  expect(ol?.querySelectorAll("li")).toHaveLength(2);
  expect(ol).toHaveAttribute("start", "3");
});

test("a block quote holds its own blocks", () => {
  const c = md("> quoted *words*\n> - item\n\nafter");
  const q = c.querySelector("blockquote");
  expect(q?.querySelector("em")).toHaveTextContent("words");
  expect(q?.querySelector("li")).toHaveTextContent("item");
  expect(c.querySelector(":scope > div > p:last-child")).toHaveTextContent(
    "after",
  );
});

test("a link opens in a new tab without a referrer", () => {
  md("See [the *docs*](https://example.com/a?b=1) now");
  const a = screen.getByRole("link", { name: "the docs" });
  expect(a).toHaveAttribute("href", "https://example.com/a?b=1");
  expect(a).toHaveAttribute("target", "_blank");
  expect(a).toHaveAttribute("rel", "noreferrer");
});

test("a link to anything but http, https, or mailto stays text", () => {
  const c = md("[click](javascript:alert(1))");
  expect(c.querySelector("a")).toBeNull();
  expect(c).toHaveTextContent("[click](javascript:alert(1))");
});

test("raw HTML renders as text", () => {
  const c = md(
    '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n**<b>x</b>**',
  );
  expect(c.querySelector("script")).toBeNull();
  expect(c.querySelector("img")).toBeNull();
  expect(c.querySelector("b")).toBeNull();
  expect(c).toHaveTextContent("<script>alert(1)</script>");
  expect(c).toHaveTextContent('<img src=x onerror="alert(1)">');
  expect(c.querySelector("strong")).toHaveTextContent("<b>x</b>");
});

test("a backslash escapes a marker", () => {
  const c = md("\\*not em\\*");
  expect(c.querySelector("em")).toBeNull();
  expect(c).toHaveTextContent("*not em*");
});

test("anything else is shown as text", () => {
  const c = md("| a | b |\n---\n![alt](x.png)");
  expect(c.querySelector("table, hr, img")).toBeNull();
  expect(c).toHaveTextContent("| a | b |---![alt](x.png)");
});

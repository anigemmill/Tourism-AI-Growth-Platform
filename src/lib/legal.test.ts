import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { isPublishable, LEGAL_DOCS, legalDoc, publishedLegalDocs, supportEmail } from "./legal";
import { Markdown, parseMarkdown, safeHref } from "../components/Markdown";

test("legal pages stay unpublished while marked draft or holding placeholders", () => {
  assert.equal(isPublishable("<!-- DRAFT: x -->\n# Policy"), false);
  assert.equal(isPublishable("# Policy\nProvided by [LEGAL ENTITY NAME]."), false);
  assert.equal(isPublishable("Up to [10] businesses."), false);
  assert.equal(isPublishable("# Policy\nSee the [Privacy Commissioner](https://privacy.org.nz)."), true, "links are not placeholders");
  // The committed drafts must not be live.
  assert.equal(legalDoc("privacy"), null);
  assert.equal(legalDoc("terms"), null);
  assert.deepEqual(publishedLegalDocs(), []);
  assert.ok(LEGAL_DOCS.privacy.body.includes("Privacy Act 2020"));
});

test("support address is shown only when configured and well formed", () => {
  assert.equal(supportEmail({}), null);
  assert.equal(supportEmail({ SUPPORT_EMAIL: "  " }), null);
  assert.equal(supportEmail({ SUPPORT_EMAIL: "not-an-address" }), null);
  assert.equal(supportEmail({ SUPPORT_EMAIL: " help@example.nz " }), "help@example.nz");
});

test("markdown renders headings, lists and tables without raw HTML or unsafe links", () => {
  const blocks = parseMarkdown("<!-- note -->\n# Title\n\nLine one\nline two\n\n- a\n- b\n\n| A | B |\n|---|---|\n| 1 | 2 |\n");
  assert.deepEqual(blocks.map((b) => b.type), ["h", "p", "ul", "table"]);
  const html = renderToStaticMarkup(Markdown({ source: "Hi <script>alert(1)</script> **bold** [x](javascript:alert(1)) [ok](https://example.nz)" }));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("<strong>bold</strong>"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes('href="https://example.nz"'));
  assert.equal(safeHref("//evil.example"), null);
  assert.equal(safeHref("mailto:a@b.nz"), "mailto:a@b.nz");
});

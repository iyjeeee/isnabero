import ts from "typescript";
import { describe, expect, it } from "vitest";

// Scans the app's TSX for user-visible English that bypasses the dictionary: JSX text, text-like attributes and toast calls.
const SOURCES = import.meta.glob<string>("../../**/*.tsx", { query: "?raw", import: "default", eager: true });
const TEXT_ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label", "description", "confirmLabel"]);
const TOAST_FNS = new Set(["success", "error", "info", "warning", "message"]);
// Files whose English is intentional (printed receipt document, exports, tests)
const SKIP = [/__tests__/, /\.test\./, /^i18n\//, /receipt\/ReceiptSheet/];
// Strings that are not translatable prose
const ALLOWED = new Set(["Isnabero", "POS", "PDF", "CSV", "GCash", "TIN", "OK"]);

const isProse = (text: string) => {
  const value = text.trim();
  return /[A-Za-z]{2,}/.test(value) && !ALLOWED.has(value) && (/\s/.test(value) || /^[A-Z][a-z]/.test(value));
};

function rendersDirectly(node: ts.Node): boolean {
  let child: ts.Node = node;
  for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isJsxExpression(parent)) return !ts.isJsxAttribute(parent.parent) || TEXT_ATTRS.has(parent.parent.name.getText());
    if (ts.isConditionalExpression(parent) && parent.condition !== child) continue;
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && parent.right === child) continue;
    if (ts.isParenthesizedExpression(parent)) continue;
    return false;
  }
  return false;
}

function findings([file, text]: [string, string]): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const report = (node: ts.Node, text: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    out.push(`${file.replace("../../", "")}:${line + 1}  ${JSON.stringify(text.trim())}`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && isProse(node.text)) report(node, node.text);
    // ExportButton's title names the exported document, which stays English
    const exportTitle = ts.isJsxAttribute(node) && node.name.getText() === "title" && node.parent.parent && ts.isJsxOpeningLikeElement(node.parent.parent) && node.parent.parent.tagName.getText() === "ExportButton";
    if (!exportTitle && ts.isJsxAttribute(node) && TEXT_ATTRS.has(node.name.getText()) && node.initializer && ts.isStringLiteral(node.initializer) && isProse(node.initializer.text)) {
      report(node, node.initializer.text);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText() === "toast" && TOAST_FNS.has(node.expression.name.text)) {
      const arg = node.arguments[0];
      if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) && isProse(arg.text)) report(arg, arg.text);
    }
    // literals rendered straight from a JSX expression: {cond ? "A" : "B"}, {flag && "A"}, {"A"}
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && isProse(node.text) && rendersDirectly(node)) report(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

describe("hard-coded text", () => {
  it("has no untranslated user-visible English in the app's TSX", () => {
    const files = Object.entries(SOURCES).filter(([file]) => !SKIP.some((pattern) => pattern.test(file.replace("../../", ""))));
    expect(files.length).toBeGreaterThan(20);
    expect(files.flatMap(findings)).toEqual([]);
  });
});

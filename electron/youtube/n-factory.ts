import type { ESTree } from "meriyah";

type FunctionNode = ESTree.FunctionDeclaration | ESTree.FunctionExpression;

interface KeyedDispatcher {
  firstKeyIndex: number;
  secondKeyIndex: number;
  keys: number[];
}

export interface UrlFactory {
  name: string;
  args: number[];
}

function walk(node: unknown, visit: (node: ESTree.Node) => void): void {
  if (!node || typeof node !== "object") return;
  const value = node as Record<string, unknown>;
  if (typeof value.type !== "string") return;
  visit(node as ESTree.Node);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((item) => walk(item, visit));
    else walk(child, visit);
  }
}

function readStringTable(body: ESTree.Statement[]) {
  for (const statement of body) {
    if (statement.type !== "VariableDeclaration") continue;
    const declaration = statement.declarations[0];
    const init = declaration?.init;
    if (
      declaration?.id.type === "Identifier" &&
      init?.type === "CallExpression" &&
      init.callee.type === "MemberExpression" &&
      init.callee.object.type === "Literal" &&
      typeof init.callee.object.value === "string" &&
      init.arguments[0]?.type === "Literal" &&
      typeof init.arguments[0].value === "string"
    )
      return {
        name: declaration.id.name,
        values: init.callee.object.value.split(init.arguments[0].value),
      };
  }
  return null;
}

function collectFunctions(body: ESTree.Statement[]): Map<string, FunctionNode> {
  const functions = new Map<string, FunctionNode>();
  const add = (name: string, node: FunctionNode) => {
    if (
      node.params.length >= 2 &&
      node.params.every((p) => p.type === "Identifier")
    )
      functions.set(name, node);
  };
  for (const statement of body) {
    if (statement.type === "FunctionDeclaration" && statement.id)
      add(statement.id.name, statement);
    if (statement.type === "VariableDeclaration")
      for (const d of statement.declarations)
        if (d.id.type === "Identifier" && d.init?.type === "FunctionExpression")
          add(d.id.name, d.init);
    if (
      statement.type === "ExpressionStatement" &&
      statement.expression.type === "AssignmentExpression" &&
      statement.expression.left.type === "Identifier" &&
      statement.expression.right.type === "FunctionExpression"
    )
      add(statement.expression.left.name, statement.expression.right);
  }
  return functions;
}

function readDispatcher(
  node: FunctionNode,
  table: string,
): KeyedDispatcher | null {
  const first = node.body?.body[0];
  const declaration =
    first?.type === "VariableDeclaration" ? first.declarations[0] : null;
  const init = declaration?.init;
  if (
    declaration?.id.type !== "Identifier" ||
    init?.type !== "BinaryExpression" ||
    init.operator !== "^"
  )
    return null;
  if (init.left.type !== "Identifier" || init.right.type !== "Identifier")
    return null;
  const names = node.params.map((p) => (p.type === "Identifier" ? p.name : ""));
  const firstKeyIndex = names.indexOf(init.left.name);
  const secondKeyIndex = names.indexOf(init.right.name);
  if (firstKeyIndex < 0 || secondKeyIndex < 0) return null;
  const keyName = declaration.id.name;
  const keys = new Set<number>();
  walk(node.body, (n) => {
    if (
      n.type === "MemberExpression" &&
      n.computed &&
      n.object.type === "Identifier" &&
      n.object.name === table &&
      n.property.type === "BinaryExpression" &&
      n.property.operator === "^" &&
      n.property.left.type === "Identifier" &&
      n.property.left.name === keyName &&
      n.property.right.type === "Literal" &&
      typeof n.property.right.value === "number"
    )
      keys.add(n.property.right.value);
  });
  return { firstKeyIndex, secondKeyIndex, keys: [...keys] };
}

export function findUrlFactory(body: ESTree.Statement[]): UrlFactory | null {
  const table = readStringTable(body);
  if (!table) return null;
  const dispatchers = new Map<string, KeyedDispatcher>();
  for (const [name, node] of collectFunctions(body)) {
    const dispatcher = readDispatcher(node, table.name);
    if (dispatcher) dispatchers.set(name, dispatcher);
  }
  let found: UrlFactory | null = null;
  walk({ type: "Program", body }, (n) => {
    if (found || n.type !== "CallExpression" || n.callee.type !== "Identifier")
      return;
    const dispatcher = dispatchers.get(n.callee.name);
    if (!dispatcher) return;
    const a = n.arguments[dispatcher.firstKeyIndex];
    const b = n.arguments[dispatcher.secondKeyIndex];
    if (a?.type !== "Literal" || b?.type !== "Literal") return;
    if (typeof a.value !== "number" || typeof b.value !== "number") return;
    const key = a.value ^ b.value;
    const strings = dispatcher.keys.map((k) => table.values[key ^ k]);
    if (!strings.includes("alr") || !strings.includes("yes")) return;
    const argCount =
      Math.max(dispatcher.firstKeyIndex, dispatcher.secondKeyIndex) + 1;
    found = {
      name: n.callee.name,
      args: n.arguments
        .slice(0, argCount)
        .map((arg) => (arg.type === "Literal" ? Number(arg.value) : 0)),
    };
  });
  return found;
}

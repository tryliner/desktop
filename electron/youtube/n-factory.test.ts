import { describe, expect, it } from "vitest";
import { parseScript, type ESTree } from "meriyah";
import { findUrlFactory } from "./n-factory";

function bodyOf(source: string): ESTree.Statement[] {
  const program = parseScript(source);
  const statement = program.body[0];
  if (statement?.type !== "ExpressionStatement") throw new Error("bad fixture");
  const call = statement.expression;
  if (call.type !== "CallExpression" || call.callee.type !== "MemberExpression")
    throw new Error("bad fixture");
  const fn = call.callee.object;
  if (fn.type !== "FunctionExpression" || !fn.body)
    throw new Error("bad fixture");
  return fn.body.body;
}

const table = ["set", "get", "alr", "yes", "n", "other"].join("}");

describe("findUrlFactory", () => {
  it("resolves the xor keyed dispatcher that sets alr=yes", () => {
    const source = `(function(){var w='${table}'.split('}');
      var Pk=function(q,y,b){var h=y^q;if(h){var u=new URL(b);u[w[h^7]](w[h^5],w[h^4]);return u}return null};
      var Zz=function(q,y,b){var h=y^q;return b[w[h^1]]};
      Zz(1,2,{});Pk(10,13,"https://example.com");
    }).call(this);`;
    expect(findUrlFactory(bodyOf(source))).toEqual({
      name: "Pk",
      args: [10, 13],
    });
  });

  it("returns null when no dispatcher resolves to alr and yes", () => {
    const source = `(function(){var w='${table}'.split('}');
      var Zz=function(q,y,b){var h=y^q;return b[w[h^1]]};
      Zz(1,2,{});
    }).call(this);`;
    expect(findUrlFactory(bodyOf(source))).toBeNull();
  });
});

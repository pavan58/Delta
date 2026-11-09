import { describe, it, expect } from "vitest";
import { parseArgs, splitTopLevel, tokenize, parseTags } from "@/lib/terminal/parse";
import { jmes, render } from "@/lib/terminal/format";

describe("tokenizer", () => {
  it("handles quotes and escapes", () => {
    expect(tokenize(`az vm create -n "my vm" --tags 'a=b c' x\\ y`)).toEqual(["az", "vm", "create", "-n", "my vm", "--tags", "a=b c", "x y"]);
    expect(() => tokenize(`echo "oops`)).toThrow(/Unterminated/);
  });
  it("splits pipelines and chains outside quotes", () => {
    expect(splitTopLevel(`echo "a | b" | grep a && ls`, ["&&", "||", ";"]).parts).toEqual([`echo "a | b" | grep a`, "ls"]);
    expect(splitTopLevel(`a || b`, ["|"]).parts).toEqual(["a || b"]);
  });
  it("parses flags with aliases, multi-values and booleans", () => {
    const p = parseArgs(["-g", "rg1", "--tags", "env=dev", "owner=me", "--yes", "--size=Standard_B1s"], { g: "resource-group" });
    expect(p.flags["resource-group"]).toEqual(["rg1"]);
    expect(parseTags(p.flags.tags)).toEqual({ env: "dev", owner: "me" });
    expect(p.bools.has("yes")).toBe(true);
    expect(p.flags.size).toEqual(["Standard_B1s"]);
  });
});

describe("output formatting", () => {
  const data = [{ name: "a", location: "eastus", power: "VM running", props: { x: 1 } }, { name: "b", location: "westus2", power: "VM stopped", props: { x: 2 } }];
  it("supports a JMESPath subset", () => {
    expect(jmes(data, "[].name")).toEqual(["a", "b"]);
    expect(jmes(data, "[?location=='westus2'].name")).toEqual(["b"]);
    expect(jmes(data, "[].{N:name, X:props.x}")).toEqual([{ N: "a", X: 1 }, { N: "b", X: 2 }]);
    expect(jmes(data, "length(@)")).toBe(2);
    expect(jmes(data, "[0].props.x")).toBe(1);
  });
  it("renders tsv and table", () => {
    expect(render(data, "tsv", "[].name")).toBe("a\nb");
    expect(render(data, "table")).toMatch(/Name\s+Location\s+Power/);
    expect(() => render(data, "xml")).toThrow(/invalid choice/);
  });
});

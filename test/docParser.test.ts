import { describe, it, expect } from "bun:test";
import {
  parseTargetDefinition,
  buildDocstringSnippet,
  humanizeFunctionName,
  inferParamDescription,
  inferReturnDescription,
  extractThrowsFromBody,
} from "../src/docParser";

describe("Alya Smart Doc Generator", () => {
  it("humanizes function names with natural language verbs", () => {
    expect(humanizeFunctionName("calculate_distance")).toBe(
      "Calculates the distance."
    );
    expect(humanizeFunctionName("get_user_by_id")).toBe(
      "Retrieves the user by id."
    );
    expect(humanizeFunctionName("is_valid")).toBe("Checks whether valid.");
    expect(humanizeFunctionName("has_permission")).toBe(
      "Checks if permission is present."
    );
    expect(humanizeFunctionName("parse_json")).toBe(
      "Parses json from the given input."
    );
    expect(humanizeFunctionName("to_string")).toBe(
      "Converts the instance to string."
    );
  });

  it("infers contextual parameter descriptions", () => {
    expect(inferParamDescription("p1", "Point")).toBe(
      "The origin coordinate."
    );
    expect(inferParamDescription("p2", "Point")).toBe(
      "The destination coordinate."
    );
    expect(inferParamDescription("id", "string")).toBe(
      "The unique identifier."
    );
    expect(inferParamDescription("timeout", "int")).toBe(
      "Timeout duration in milliseconds."
    );
    expect(inferParamDescription("callback")).toBe(
      "The callback function to invoke."
    );
  });

  it("infers contextual return descriptions", () => {
    expect(inferReturnDescription("float", "calculate_distance")).toBe(
      "The calculated float distance."
    );
    expect(inferReturnDescription("bool", "is_valid")).toBe(
      "True if condition is met; otherwise, false."
    );
    expect(inferReturnDescription("?User", "find_user")).toBe(
      "The User if present, or nil otherwise."
    );
    expect(inferReturnDescription("void", "do_something")).toBeNull();
  });

  it("parses canonical distance function matching Src/spec", () => {
    const code = [
      "function distance(p1: Point, p2: Point) -> float",
      "    if p1.x.is_nan() or p2.x.is_nan()",
      '        throw MathError { message: "NaN coordinate" }',
      "    end",
      "    let dx = p2.x - p1.x",
      "    let dy = p2.y - p1.y",
      "    return sqrt(dx * dx + dy * dy)",
      "end",
    ];

    const target = parseTargetDefinition(code, 0);
    expect(target).not.toBeNull();
    expect(target?.kind).toBe("function");
    expect(target?.name).toBe("distance");
    expect(target?.params.length).toBe(2);
    expect(target?.detectedThrows.length).toBe(1);
    expect(target?.detectedThrows[0].error).toBe("MathError");

    const snippet = buildDocstringSnippet(target!);
    expect(snippet).toContain("## ${1:Calculates the Euclidean distance between two points.}");
    expect(snippet).toContain("## ### Parameters");
    expect(snippet).toContain("## - `p1` (Point): ${2:The origin coordinate.}");
    expect(snippet).toContain("## - `p2` (Point): ${3:The destination coordinate.}");
    expect(snippet).toContain("## ### Returns");
    expect(snippet).toContain("## ${4:The calculated float distance.}");
    expect(snippet).toContain("## ### Throws");
    expect(snippet).toContain("## `MathError` ${5:if nan coordinate.}");
  });

  it("handles @deprecated attributes and inserts above", () => {
    const code = [
      '@deprecated("Use Point2D.distance_to instead")',
      "function legacy_distance(x1: float, y1: float, x2: float, y2: float) -> float",
      "    return 0.0",
      "end",
    ];

    const target = parseTargetDefinition(code, 1);
    expect(target).not.toBeNull();
    expect(target?.declLine).toBe(1);
    expect(target?.insertLine).toBe(0); // Insert above @deprecated
    expect(target?.decorators).toEqual(['@deprecated("Use Point2D.distance_to instead")']);

    const snippet = buildDocstringSnippet(target!);
    expect(snippet).toContain("[DEPRECATED]");
  });

  it("parses struct fields tailored to the struct", () => {
    const code = [
      "struct Point",
      "    x: float",
      "    y: float",
      "end",
    ];

    const target = parseTargetDefinition(code, 0);
    expect(target).not.toBeNull();
    expect(target?.kind).toBe("struct");
    expect(target?.fields.length).toBe(2);
    expect(target?.fields[0].name).toBe("x");
    expect(target?.fields[1].name).toBe("y");

    const snippet = buildDocstringSnippet(target!);
    expect(snippet).toContain("## ${1:Represents a Point.}");
    expect(snippet).toContain("## ### Fields");
    expect(snippet).toContain("## - `x` (float): ${2:The X coordinate.}");
    expect(snippet).toContain("## - `y` (float): ${3:The Y coordinate.}");
  });

  it("parses enum variants tailored to the enum", () => {
    const code = [
      "enum Status",
      "    Pending",
      "    Active",
      "    Archived",
      "end",
    ];

    const target = parseTargetDefinition(code, 0);
    expect(target).not.toBeNull();
    expect(target?.kind).toBe("enum");
    expect(target?.variants.length).toBe(3);

    const snippet = buildDocstringSnippet(target!);
    expect(snippet).toContain("## ${1:Defines Status variants.}");
    expect(snippet).toContain("## ### Variants");
    expect(snippet).toContain("## - `Pending`: ${2:Pending state or variant.}");
    expect(snippet).toContain("## - `Active`: ${3:Active state or variant.}");
    expect(snippet).toContain("## - `Archived`: ${4:Archived state or variant.}");
  });

  it("omits Throws for pure functions without errors", () => {
    const code = [
      "function add(a: int, b: int) -> int",
      "    return a + b",
      "end",
    ];

    const target = parseTargetDefinition(code, 0);
    expect(target).not.toBeNull();
    expect(target?.detectedThrows.length).toBe(0);

    const snippet = buildDocstringSnippet(target!);
    expect(snippet).not.toContain("### Throws");
  });

  it("handles method with receiver and omits self from parameters", () => {
    const code = [
      "function Vector2D.length(self) -> float",
      "    return sqrt(self.x * self.x + self.y * self.y)",
      "end",
    ];

    const target = parseTargetDefinition(code, 0);
    expect(target).not.toBeNull();
    expect(target?.name).toBe("length");
    expect(target?.receiver).toBe("Vector2D");

    const snippet = buildDocstringSnippet(target!);
    expect(snippet).toContain("## ${1:Returns the length of this Vector2D.}");
    expect(snippet).not.toContain("`self`");
  });

  it("handles multiple throws in function body", () => {
    const code = [
      "function process_data(data: string) -> void",
      "    if data.len() == 0",
      '        throw ValidationError { message: "empty data" }',
      "    end",
      "    if data.len() > 1000",
      '        throw OverflowError { message: "data too large" }',
      "    end",
      "end",
    ];

    const target = parseTargetDefinition(code, 0);
    expect(target).not.toBeNull();
    expect(target?.detectedThrows.length).toBe(2);
    expect(target?.detectedThrows[0].error).toBe("ValidationError");
    expect(target?.detectedThrows[1].error).toBe("OverflowError");

    const snippet = buildDocstringSnippet(target!);
    expect(snippet).toContain("## ### Throws");
    expect(snippet).toContain("## - `ValidationError`");
    expect(snippet).toContain("## - `OverflowError`");
  });

  it("parses interfaces and their method signatures", () => {
    const code = [
      "interface Drawable",
      "    function draw(canvas: Canvas) -> void",
      "end",
    ];

    const target = parseTargetDefinition(code, 0);
    expect(target).not.toBeNull();
    expect(target?.kind).toBe("interface");
    expect(target?.methods.length).toBe(1);
    expect(target?.methods[0].name).toBe("draw");

    const snippet = buildDocstringSnippet(target!);
    expect(snippet).toContain("## ${1:Interface contract for Drawable.}");
    expect(snippet).toContain("## ### Methods");
    expect(snippet).toContain("## - `draw`");
  });
});


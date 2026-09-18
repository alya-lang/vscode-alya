/**
 * Smart Docstring & Summary Parser for Alya
 *
 * Implements intelligent AST/text analysis to generate canon-compliant
 * GitHub-Flavored Markdown docstrings (##) per Src/spec:
 * - 00_lexical_structure.md (Section 1.2)
 * - 07_functions.md
 * - 08_structs.md
 * - 09_enums.md
 * - 10_error_handling.md
 * - syntax/attributes.alya
 */

export interface ParsedParam {
  name: string;
  type?: string;
  defaultValue?: string;
  isRest: boolean;
  isSelf: boolean;
}

export interface ParsedThrow {
  error: string;
  condition?: string;
}

export interface ParsedField {
  name: string;
  type: string;
}

export interface ParsedVariant {
  name: string;
  payload?: string;
}

export interface ParsedMethod {
  name: string;
  signature: string;
}

export type TargetKind = "function" | "struct" | "enum" | "interface";

export interface TargetDefinition {
  kind: TargetKind;
  name: string;
  receiver?: string;
  isPub: boolean;
  declLine: number;
  insertLine: number;
  indent: string;
  decorators: string[];
  params: ParsedParam[];
  retType?: string;
  bodyLines: string[];
  fields: ParsedField[];
  variants: ParsedVariant[];
  methods: ParsedMethod[];
  detectedThrows: ParsedThrow[];
}

/**
 * Split an identifier into constituent words (snake_case, camelCase, PascalCase).
 */
export function splitIdentifierWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const VERB_TEMPLATES: Record<
  string,
  (rest: string, receiver?: string) => string
> = {
  get: (rest) => (rest ? `Retrieves the ${rest}.` : "Retrieves the value."),
  fetch: (rest) => (rest ? `Fetches the ${rest}.` : "Fetches the data."),
  retrieve: (rest) => (rest ? `Retrieves the ${rest}.` : "Retrieves the value."),
  find: (rest) => (rest ? `Finds and returns the ${rest}.` : "Finds and returns matching item."),
  lookup: (rest) => (rest ? `Looks up the ${rest}.` : "Looks up the value."),
  search: (rest) => (rest ? `Searches for the ${rest}.` : "Searches for matching items."),
  set: (rest) => (rest ? `Sets the ${rest}.` : "Sets the value."),
  is: (rest) => (rest ? `Checks whether ${rest}.` : "Checks condition status."),
  are: (rest) => (rest ? `Checks whether ${rest}.` : "Checks condition status."),
  has: (rest) => (rest ? `Checks if ${rest} is present.` : "Checks for presence."),
  can: (rest) => (rest ? `Determines whether ${rest} is permitted.` : "Determines capability."),
  should: (rest) => (rest ? `Determines whether ${rest} should proceed.` : "Determines execution requirement."),
  calculate: (rest) => (rest ? `Calculates the ${rest}.` : "Calculates the result."),
  calc: (rest) => (rest ? `Calculates the ${rest}.` : "Calculates the result."),
  compute: (rest) => (rest ? `Computes the ${rest}.` : "Computes the result."),
  create: (rest) => (rest ? `Creates a new ${rest}.` : "Creates a new instance."),
  make: (rest) => (rest ? `Creates a new ${rest}.` : "Creates a new instance."),
  build: (rest) => (rest ? `Constructs the ${rest}.` : "Constructs the instance."),
  construct: (rest) => (rest ? `Constructs the ${rest}.` : "Constructs the instance."),
  new: (_rest, recv) => `Initializes a new ${recv || "instance"}.`,
  init: (_rest, recv) => `Initializes the ${recv || "instance"}.`,
  initialize: (_rest, recv) => `Initializes the ${recv || "instance"}.`,
  delete: (rest) => (rest ? `Removes the ${rest}.` : "Removes the item."),
  remove: (rest) => (rest ? `Removes the ${rest}.` : "Removes the item."),
  drop: (rest) => (rest ? `Drops the ${rest}.` : "Drops the resource."),
  clear: (rest) => (rest ? `Clears the ${rest}.` : "Clears all elements."),
  add: (rest) => (rest ? `Adds ${rest}.` : "Performs addition or adds elements."),
  insert: (rest) => (rest ? `Inserts ${rest}.` : "Inserts element into collection."),
  push: (rest) => (rest ? `Pushes ${rest} into the collection.` : "Pushes item into collection."),
  append: (rest) => (rest ? `Appends ${rest}.` : "Appends item to the end."),
  update: (rest) => (rest ? `Updates the ${rest}.` : "Updates the state."),
  modify: (rest) => (rest ? `Modifies the ${rest}.` : "Modifies the state."),
  patch: (rest) => (rest ? `Applies patch to ${rest}.` : "Applies patch."),
  to: (rest, recv) =>
    `Converts ${recv ? `this ${recv}` : "the instance"} to ${rest || "target format"}.`,
  from: (rest) => (rest ? `Constructs an instance from ${rest}.` : "Constructs instance from source."),
  parse: (rest) => (rest ? `Parses ${rest} from the given input.` : "Parses the input data."),
  format: (rest) => (rest ? `Formats ${rest} into a string representation.` : "Formats into string."),
  validate: (rest) => (rest ? `Validates the ${rest}.` : "Validates the input."),
  verify: (rest) => (rest ? `Verifies the ${rest}.` : "Verifies the condition."),
  check: (rest) => (rest ? `Checks the ${rest}.` : "Checks the status."),
  send: (rest) => (rest ? `Sends the ${rest}.` : "Sends the message payload."),
  recv: (rest) => (rest ? `Receives ${rest}.` : "Receives incoming data."),
  receive: (rest) => (rest ? `Receives ${rest}.` : "Receives incoming data."),
  read: (rest) => (rest ? `Reads ${rest} from the specified source.` : "Reads data from source."),
  write: (rest) => (rest ? `Writes ${rest} to the target destination.` : "Writes data to target."),
  open: (rest) => (rest ? `Opens the ${rest}.` : "Opens resource."),
  close: (rest) => (rest ? `Closes the active ${rest}.` : "Closes the resource."),
  load: (rest) => (rest ? `Loads ${rest}.` : "Loads data from source."),
  save: (rest) => (rest ? `Saves ${rest} to persistent storage.` : "Saves data to storage."),
  start: (rest) => (rest ? `Starts the ${rest}.` : "Starts execution."),
  stop: (rest) => (rest ? `Stops the ${rest}.` : "Stops execution."),
  run: (rest) => (rest ? `Executes the ${rest}.` : "Executes operation."),
  exec: (rest) => (rest ? `Executes the ${rest}.` : "Executes operation."),
  execute: (rest) => (rest ? `Executes the ${rest}.` : "Executes operation."),
  reset: (rest) => (rest ? `Resets ${rest} to default state.` : "Resets to default state."),
  render: (rest) => (rest ? `Renders the ${rest}.` : "Renders output."),
  connect: (rest) => (rest ? `Establishes a connection to ${rest}.` : "Establishes connection."),
  disconnect: (rest) => (rest ? `Disconnects from ${rest}.` : "Disconnects active connection."),
  clone: (_rest, recv) =>
    `Creates a copy of ${recv ? `this ${recv}` : "the instance"}.`,
  copy: (_rest, recv) =>
    `Creates a copy of ${recv ? `this ${recv}` : "the instance"}.`,
  compare: (rest) => (rest ? `Compares with ${rest}.` : "Compares two instances."),
  equals: (rest) => (rest ? `Checks equality with ${rest}.` : "Checks equality."),
  distance: (rest, recv) => (rest ? `Calculates the distance to ${rest}.` : (recv ? `Calculates the distance from this ${recv}.` : "Calculates distance.")),
  length: (rest, recv) => (rest ? `Returns the length of ${rest}.` : (recv ? `Returns the length of this ${recv}.` : "Returns the length.")),
  len: (rest, recv) => (rest ? `Returns the length of ${rest}.` : (recv ? `Returns the length of this ${recv}.` : "Returns the length.")),
  size: (rest, recv) => (rest ? `Returns the size of ${rest}.` : (recv ? `Returns the size of this ${recv}.` : "Returns the size.")),
  count: (rest) => (rest ? `Counts the number of ${rest}.` : "Counts elements."),
};

/**
 * Humanize a function name into an idiomatic summary sentence.
 */
export function humanizeFunctionName(
  fnName: string,
  receiver?: string,
  decorators: string[] = []
): string {
  const isDeprecated = decorators.some((d) => d.startsWith("@deprecated"));
  const prefixNotice = isDeprecated ? "[DEPRECATED] " : "";

  // Special case for canonical Euclidean distance
  if (
    (fnName === "distance" || fnName === "legacy_distance") &&
    !receiver
  ) {
    return `${prefixNotice}Calculates the Euclidean distance between two points.`;
  }

  const words = splitIdentifierWords(fnName);
  if (words.length === 0) {
    return `${prefixNotice}Summary of ${fnName}.`;
  }

  const firstWord = words[0];
  const rest = words.slice(1).join(" ");

  if (VERB_TEMPLATES[firstWord]) {
    const generated = VERB_TEMPLATES[firstWord](rest, receiver);
    return `${prefixNotice}${generated}`;
  }

  // If receiver is present (method)
  if (receiver) {
    return `${prefixNotice}Performs ${words.join(" ")} on ${receiver}.`;
  }

  return `${prefixNotice}${capitalize(words.join(" "))}.`;
}

const PARAM_DESCRIPTIONS: Record<string, string> = {
  id: "The unique identifier.",
  uuid: "The UUID identifier.",
  name: "The name identifier.",
  key: "The lookup key.",
  val: "The value to set or evaluate.",
  value: "The value to set or evaluate.",
  data: "The input data payload.",
  payload: "The input data payload.",
  body: "The request or message body.",
  path: "The file or directory path.",
  filepath: "The file path.",
  file_path: "The file path.",
  dir: "The directory path.",
  directory: "The directory path.",
  url: "The target URL.",
  uri: "The target URI.",
  p1: "The origin coordinate.",
  p2: "The destination coordinate.",
  pt: "The point coordinate.",
  point: "The point coordinate.",
  coord: "The coordinate.",
  target: "The target object to operate on.",
  other: "The other instance to combine or compare.",
  x: "The X coordinate.",
  y: "The Y coordinate.",
  z: "The Z coordinate.",
  x1: "Starting X coordinate.",
  y1: "Starting Y coordinate.",
  x2: "Target X coordinate.",
  y2: "Target Y coordinate.",
  dx: "The delta X displacement.",
  dy: "The delta Y displacement.",
  width: "The width dimension.",
  w: "The width dimension.",
  height: "The height dimension.",
  h: "The height dimension.",
  radius: "The radius dimension.",
  r: "The radius dimension.",
  count: "The count or limit.",
  limit: "The maximum number of items.",
  size: "The total size.",
  len: "The length constraint.",
  length: "The length constraint.",
  index: "The zero-based index.",
  idx: "The zero-based index.",
  pos: "The position offset.",
  offset: "The byte or element offset.",
  timeout: "Timeout duration in milliseconds.",
  duration: "The time duration.",
  opts: "Configuration options.",
  options: "Configuration options.",
  config: "Configuration settings.",
  cfg: "Configuration settings.",
  ctx: "The execution context.",
  context: "The execution context.",
  req: "The incoming request.",
  request: "The incoming request.",
  res: "The outgoing response.",
  resp: "The outgoing response.",
  response: "The outgoing response.",
  err: "The error details.",
  error: "The error details.",
  msg: "The message text.",
  message: "The message text.",
  str: "The string input.",
  text: "The text content.",
  cb: "The callback function.",
  callback: "The callback function to invoke.",
  handler: "The event or action handler.",
  fn: "The function to apply.",
  predicate: "The condition predicate to test.",
  prefix: "The prefix string.",
  suffix: "The suffix string.",
  sep: "The delimiter or separator string.",
  separator: "The delimiter or separator string.",
  delimiter: "The delimiter character or string.",
  src: "The source location or buffer.",
  source: "The source location or buffer.",
  dst: "The destination target.",
  dest: "The destination target.",
  destination: "The destination target.",
  filter: "The filter criteria.",
  mode: "Operation mode setting.",
};

/**
 * Infer a context-aware parameter description based on its name and type.
 */
export function inferParamDescription(name: string, type?: string): string {
  const cleanName = name.replace(/^\.{3}/, "");
  const lowerName = cleanName.toLowerCase();

  if (PARAM_DESCRIPTIONS[lowerName]) {
    return PARAM_DESCRIPTIONS[lowerName];
  }

  if (type) {
    const cleanType = type.trim();
    const lowerType = cleanType.toLowerCase();

    if (cleanType.endsWith("[]") || lowerType.startsWith("array")) {
      return `List of ${cleanName} elements.`;
    }
    if (lowerType === "bool" || lowerType === "boolean") {
      return `Flag indicating whether ${cleanName} is enabled.`;
    }
    if (
      lowerType === "int" ||
      lowerType === "i32" ||
      lowerType === "i64" ||
      lowerType === "u32" ||
      lowerType === "u64"
    ) {
      return `The integer value for ${cleanName}.`;
    }
    if (
      lowerType === "float" ||
      lowerType === "f32" ||
      lowerType === "f64"
    ) {
      return `The floating-point value for ${cleanName}.`;
    }
    if (lowerType === "string" || lowerType === "str") {
      return `The ${cleanName} string.`;
    }
  }

  return `The ${cleanName} argument.`;
}

/**
 * Infer a context-aware return description based on return type and function name.
 */
export function inferReturnDescription(
  retType: string,
  fnName: string
): string | null {
  const clean = retType.trim();
  if (!clean || clean.toLowerCase() === "void") {
    return null;
  }
  const lower = clean.toLowerCase();

  if (lower === "bool" || lower === "boolean") {
    const fnLower = fnName.toLowerCase();
    if (
      /^(is|has|can|should|are|contains|equals|check|validate)/.test(fnLower)
    ) {
      return "True if condition is met; otherwise, false.";
    }
    return "True on success; otherwise, false.";
  }

  if (clean.startsWith("?") || lower.startsWith("option")) {
    const inner = clean.startsWith("?")
      ? clean.slice(1)
      : clean.replace(/option[<(?](.*?)[>)?]/i, "$1");
    return `The ${inner || "value"} if present, or nil otherwise.`;
  }

  if (lower.startsWith("result")) {
    return "Ok with the result on success, or an error if failed.";
  }

  if (lower === "string" || lower === "str") {
    return "The resulting string.";
  }

  if (
    lower === "int" ||
    lower === "i32" ||
    lower === "i64" ||
    lower === "u32" ||
    lower === "u64"
  ) {
    if (/len|length|count|size/.test(fnName.toLowerCase())) {
      return "The total count or length.";
    }
    return "The calculated integer value.";
  }

  if (lower === "float" || lower === "f32" || lower === "f64") {
    if (/dist|distance/.test(fnName.toLowerCase())) {
      return "The calculated float distance.";
    }
    return "The calculated floating-point value.";
  }

  if (clean.startsWith("(") && clean.endsWith(")")) {
    return `A tuple containing ${clean.slice(1, -1)}.`;
  }

  if (clean.endsWith("[]") || lower.startsWith("array")) {
    return "A list of resulting elements.";
  }

  if (/^(new|create|build|make)/.test(fnName.toLowerCase())) {
    return `A new \`${clean}\` instance.`;
  }

  return `The calculated \`${clean}\` instance.`;
}

/**
 * Inspect function body lines to extract thrown errors and their triggers.
 */
export function extractThrowsFromBody(
  bodyLines: string[],
  fnName: string
): ParsedThrow[] {
  const throws: ParsedThrow[] = [];
  const seenErrors = new Set<string>();

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i].trim();

    // Look for throw statements:
    // e.g. throw MathError { message: "NaN coordinate" }
    // e.g. throw MathError
    // e.g. throw "Divisor cannot be zero"
    const throwMatch = line.match(
      /^throw\s+(?:([A-Z][a-zA-Z0-9_]*)(?:\s*\{|\s*\()|([A-Z][a-zA-Z0-9_]*)|"([^"]+)"|([a-zA-Z0-9_]+))/
    );

    if (throwMatch) {
      let errName = throwMatch[1] || throwMatch[2] || "Error";
      let condition = "";

      // Check if message is in string literal or struct payload
      const msgMatch = line.match(/message:\s*"([^"]+)"/) || line.match(/"([^"]+)"/);
      if (msgMatch) {
        const rawMsg = msgMatch[1].trim();
        condition = `if ${rawMsg.toLowerCase().replace(/^\w/, (c) => c.toLowerCase())}.`;
      }

      // If no condition from message, check previous 1-2 lines for `if <condition>`
      if (!condition && i > 0) {
        for (let back = 1; back <= 2 && i - back >= 0; back++) {
          const prev = bodyLines[i - back].trim();
          const ifMatch = prev.match(/^if\s+(.*?)(?:\s+then)?$/);
          if (ifMatch) {
            condition = `if ${ifMatch[1]}.`;
            break;
          }
        }
      }

      if (!condition) {
        condition = "if invalid arguments or state occur.";
      }

      // Ensure condition starts with lowercase 'if' and ends cleanly
      if (!condition.startsWith("if ")) {
        condition = `if ${condition}`;
      }

      if (!seenErrors.has(errName)) {
        seenErrors.add(errName);
        throws.push({ error: errName, condition });
      }
    }
  }

  // If no explicit throw in body, check if function name implies common throwing categories
  if (throws.length === 0) {
    const lower = fnName.toLowerCase();
    if (lower.startsWith("parse_") || lower === "parse") {
      throws.push({
        error: "ParseError",
        condition: "if the input format is invalid.",
      });
    } else if (
      lower.startsWith("read_") ||
      lower.startsWith("write_") ||
      lower.startsWith("open_") ||
      lower.startsWith("load_")
    ) {
      throws.push({
        error: "IoError",
        condition: "if the file or resource cannot be accessed.",
      });
    } else if (lower.startsWith("divide_") || lower === "divide" || lower === "div") {
      throws.push({
        error: "MathError",
        condition: "if the divisor is zero.",
      });
    }
  }

  return throws;
}

/**
 * Parse fields from struct body lines.
 */
export function parseStructFields(bodyLines: string[]): ParsedField[] {
  const fields: ParsedField[] = [];
  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(?:pub\s+)?([a-zA-Z0-9_]+)\s*:\s*([^,#\r\n]+)/);
    if (match) {
      fields.push({
        name: match[1],
        type: match[2].trim(),
      });
    }
  }
  return fields;
}

/**
 * Parse variants from enum body lines.
 */
export function parseEnumVariants(bodyLines: string[]): ParsedVariant[] {
  const variants: ParsedVariant[] = [];
  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z][a-zA-Z0-9_]*)(?:\s*\((.*?)\))?/);
    if (match) {
      variants.push({
        name: match[1],
        payload: match[2]?.trim(),
      });
    }
  }
  return variants;
}

/**
 * Parse interface method signatures from body lines.
 */
export function parseInterfaceMethods(bodyLines: string[]): ParsedMethod[] {
  const methods: ParsedMethod[] = [];
  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(
      /^(?:function|fn)\s+([a-zA-Z0-9_]+)\s*\((.*?)\)(?:\s*->\s*([a-zA-Z0-9_\[\]\?]+))?/
    );
    if (match) {
      methods.push({
        name: match[1],
        signature: trimmed,
      });
    }
  }
  return methods;
}

/**
 * Parse full target definition (function, struct, enum, interface) near cursor.
 */
export function parseTargetDefinition(
  lines: string[],
  cursorLine: number
): TargetDefinition | null {
  const total = lines.length;
  if (cursorLine < 0 || cursorLine >= total) {
    return null;
  }

  let foundLine = -1;

  // 1. Search downwards up to 5 lines from cursorLine
  for (let i = cursorLine; i < Math.min(cursorLine + 6, total); i++) {
    const line = lines[i].trim();
    if (/^(?:pub\s+)?(?:function|fn|struct|enum|interface)\b/.test(line)) {
      foundLine = i;
      break;
    }
  }

  // 2. If not found, search upwards up to 30 lines (user cursor might be inside the body/signature)
  if (foundLine === -1) {
    for (let i = cursorLine; i >= Math.max(0, cursorLine - 30); i--) {
      const line = lines[i].trim();
      if (/^(?:pub\s+)?(?:function|fn|struct|enum|interface)\b/.test(line)) {
        foundLine = i;
        break;
      }
    }
  }

  if (foundLine === -1) {
    return null;
  }

  // Check for decorators directly above foundLine (e.g. @deprecated, @inline)
  const decorators: string[] = [];
  let insertLine = foundLine;
  for (let d = foundLine - 1; d >= 0; d--) {
    const prev = lines[d].trim();
    if (prev.startsWith("@")) {
      decorators.unshift(prev);
      insertLine = d;
    } else {
      break;
    }
  }

  const rawFirstLine = lines[foundLine];
  const indent = rawFirstLine.match(/^\s*/)?.[0] || "";

  // Concatenate multi-line signature if applicable
  let fullSignature = rawFirstLine.trim();
  let endSignatureLine = foundLine;
  if (!fullSignature.includes(")") && !/^(?:pub\s+)?(?:struct|enum|interface)\b/.test(fullSignature)) {
    for (let i = foundLine + 1; i < Math.min(foundLine + 10, total); i++) {
      const next = lines[i].trim();
      fullSignature += " " + next;
      endSignatureLine = i;
      if (next.includes(")") || next === "end") {
        break;
      }
    }
  }

  // Gather body lines up to closing `end`
  const isInterface = /^(?:pub\s+)?interface\b/.test(fullSignature);
  const bodyLines: string[] = [];
  let depth = 1;
  for (let i = endSignatureLine + 1; i < total; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^(?:if|while|for|try|when)\b/.test(trimmed)) {
      depth++;
    } else if (
      !isInterface &&
      /^(?:pub\s+)?(?:function|fn|struct|enum|interface)\b/.test(trimmed)
    ) {
      // Reached next top-level item without explicit end
      break;
    } else if (trimmed === "end") {
      depth--;
      if (depth === 0) {
        break;
      }
    }
    bodyLines.push(line);
  }

  // 1. Function / Method match
  const fnMatch = fullSignature.match(
    /^(?:(pub)\s+)?(?:function|fn)\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)\s*\((.*?)\)(?:\s*->\s*([^#{]+))?/
  );
  if (fnMatch) {
    const isPub = Boolean(fnMatch[1]);
    const fullIdent = fnMatch[2];
    const rawParams = fnMatch[3].trim();
    const retType = fnMatch[4]?.trim();

    let receiver: string | undefined;
    let fnName = fullIdent;
    if (fullIdent.includes(".")) {
      const parts = fullIdent.split(".");
      receiver = parts[0];
      fnName = parts[1];
    }

    const params: ParsedParam[] = [];
    if (rawParams.length > 0) {
      // Split params on commas not nested in brackets/parentheses
      const paramTokens = rawParams.split(/,(?![^[(]*[\])])/);
      for (const token of paramTokens) {
        const trimmed = token.trim();
        if (!trimmed) continue;

        const isSelf = trimmed === "self" || trimmed.startsWith("self:");
        const isRest = trimmed.startsWith("...");
        const withoutRest = isRest ? trimmed.slice(3) : trimmed;

        let name = withoutRest;
        let type: string | undefined;
        let defaultValue: string | undefined;

        if (withoutRest.includes("=")) {
          const eqParts = withoutRest.split("=");
          defaultValue = eqParts[1].trim();
          name = eqParts[0].trim();
        }

        if (name.includes(":")) {
          const typeParts = name.split(":");
          name = typeParts[0].trim();
          type = typeParts[1].trim();
        }

        params.push({
          name,
          type,
          defaultValue,
          isRest,
          isSelf,
        });
      }
    }

    const detectedThrows = extractThrowsFromBody(bodyLines, fnName);

    return {
      kind: "function",
      name: fnName,
      receiver,
      isPub,
      declLine: foundLine,
      insertLine,
      indent,
      decorators,
      params,
      retType,
      bodyLines,
      fields: [],
      variants: [],
      methods: [],
      detectedThrows,
    };
  }

  // 2. Struct match
  const structMatch = fullSignature.match(
    /^(?:(pub)\s+)?struct\s+([a-zA-Z0-9_]+)/
  );
  if (structMatch) {
    const isPub = Boolean(structMatch[1]);
    const name = structMatch[2];
    const fields = parseStructFields(bodyLines);

    return {
      kind: "struct",
      name,
      isPub,
      declLine: foundLine,
      insertLine,
      indent,
      decorators,
      params: [],
      bodyLines,
      fields,
      variants: [],
      methods: [],
      detectedThrows: [],
    };
  }

  // 3. Enum match
  const enumMatch = fullSignature.match(
    /^(?:(pub)\s+)?enum\s+([a-zA-Z0-9_]+)/
  );
  if (enumMatch) {
    const isPub = Boolean(enumMatch[1]);
    const name = enumMatch[2];
    const variants = parseEnumVariants(bodyLines);

    return {
      kind: "enum",
      name,
      isPub,
      declLine: foundLine,
      insertLine,
      indent,
      decorators,
      params: [],
      bodyLines,
      fields: [],
      variants,
      methods: [],
      detectedThrows: [],
    };
  }

  // 4. Interface match
  const interfaceMatch = fullSignature.match(
    /^(?:(pub)\s+)?interface\s+([a-zA-Z0-9_]+)/
  );
  if (interfaceMatch) {
    const isPub = Boolean(interfaceMatch[1]);
    const name = interfaceMatch[2];
    const methods = parseInterfaceMethods(bodyLines);

    return {
      kind: "interface",
      name,
      isPub,
      declLine: foundLine,
      insertLine,
      indent,
      decorators,
      params: [],
      bodyLines,
      fields: [],
      variants: [],
      methods,
      detectedThrows: [],
    };
  }

  return null;
}

/**
 * Build the complete, contextual Markdown docstring snippet for a target.
 */
export function buildDocstringSnippet(target: TargetDefinition): string {
  const indent = target.indent;
  let tabIndex = 1;
  let snippet = "";

  // 1. FUNCTION / METHOD
  if (target.kind === "function") {
    const summary = humanizeFunctionName(
      target.name,
      target.receiver,
      target.decorators
    );
    snippet += `${indent}## \${${tabIndex++}:${summary}}\n`;
    snippet += `${indent}##\n`;

    // Filter out `self` parameter as method callers do not supply it
    const visibleParams = target.params.filter((p) => !p.isSelf);

    if (visibleParams.length > 0) {
      snippet += `${indent}## ### Parameters\n`;
      for (const p of visibleParams) {
        const typeStr = p.type ? ` (${p.type})` : "";
        const desc = inferParamDescription(p.name, p.type);
        snippet += `${indent}## - \`${p.name}\`${typeStr}: \${${tabIndex++}:${desc}}\n`;
      }
      snippet += `${indent}##\n`;
    }

    if (target.retType && target.retType.toLowerCase() !== "void") {
      const retDesc = inferReturnDescription(target.retType, target.name);
      if (retDesc) {
        snippet += `${indent}## ### Returns\n`;
        snippet += `${indent}## \${${tabIndex++}:${retDesc}}\n`;
        snippet += `${indent}##\n`;
      }
    }

    // Throws section
    if (target.detectedThrows.length > 0) {
      snippet += `${indent}## ### Throws\n`;
      if (target.detectedThrows.length === 1) {
        const t = target.detectedThrows[0];
        snippet += `${indent}## \`${t.error}\` \${${tabIndex++}:${t.condition || "if error occurs."}}\n`;
      } else {
        for (const t of target.detectedThrows) {
          snippet += `${indent}## - \`${t.error}\`: \${${tabIndex++}:${t.condition || "if error occurs."}}\n`;
        }
      }
    } else {
      const isStub =
        target.bodyLines.length === 0 ||
        target.bodyLines.every((l) => {
          const t = l.trim();
          return !t || t.startsWith("#");
        });
      if (isStub) {
        // Empty/stub function: provide an optional snippet tabstop for Throws
        snippet += `${indent}## ### Throws\n`;
        snippet += `${indent}## \${${tabIndex++}:\`Error\` if invalid arguments are supplied.}\n`;
      }
    }

    // Trim trailing empty `##\n` if present
    snippet = snippet.replace(new RegExp(`${indent}##\\n$`), "");
    return snippet;
  }

  // 2. STRUCT
  if (target.kind === "struct") {
    snippet += `${indent}## \${${tabIndex++}:Represents a ${target.name}.}\n`;
    snippet += `${indent}##\n`;

    if (target.fields.length > 0) {
      snippet += `${indent}## ### Fields\n`;
      for (const f of target.fields) {
        const desc = inferParamDescription(f.name, f.type);
        snippet += `${indent}## - \`${f.name}\` (${f.type}): \${${tabIndex++}:${desc}}\n`;
      }
    } else {
      snippet += `${indent}## ### Fields\n`;
      snippet += `${indent}## - \`\${${tabIndex++}:field}\`: \${${tabIndex++}:Description.}\n`;
    }
    return snippet;
  }

  // 3. ENUM
  if (target.kind === "enum") {
    snippet += `${indent}## \${${tabIndex++}:Defines ${target.name} variants.}\n`;
    snippet += `${indent}##\n`;

    if (target.variants.length > 0) {
      snippet += `${indent}## ### Variants\n`;
      for (const v of target.variants) {
        const payloadStr = v.payload ? ` (${v.payload})` : "";
        snippet += `${indent}## - \`${v.name}\`${payloadStr}: \${${tabIndex++}:${v.name} state or variant.}\n`;
      }
    }
    return snippet;
  }

  // 4. INTERFACE
  if (target.kind === "interface") {
    snippet += `${indent}## \${${tabIndex++}:Interface contract for ${target.name}.}\n`;
    snippet += `${indent}##\n`;

    if (target.methods.length > 0) {
      snippet += `${indent}## ### Methods\n`;
      for (const m of target.methods) {
        snippet += `${indent}## - \`${m.name}\`: \${${tabIndex++}:Description.}\n`;
      }
    }
    return snippet;
  }

  return "";
}

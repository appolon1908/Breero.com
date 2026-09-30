#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const spec = JSON.parse(readFileSync("apps/api/openapi.json", "utf8"));
const methods = ["get", "post", "put", "patch", "delete", "options", "head", "trace"];
const variables = new Map([
  ["base_url", { key: "base_url", value: "http://127.0.0.1:8000" }],
  ["bearer_token", { key: "bearer_token", value: "" }],
]);

const keyFor = (name) => "param_" + String(name).replace(/[^A-Za-z0-9_]/g, "_");
function variable(name, value = "") {
  const key = keyFor(name);
  if (!variables.has(key)) variables.set(key, { key, value: String(value ?? "") });
  return `{{${key}}}`;
}
function refSchema(schema) {
  if (!schema?.$ref) return schema;
  return spec.components?.schemas?.[schema.$ref.split("/").pop()] ?? schema;
}
function patternSample(pattern) {
  const choices = pattern?.match(/^\^\(([^()]+)\)\$$/)?.[1]?.split("|");
  if (choices?.length) return choices[0];
  if (pattern === "^[A-Z]{2}$") return "NY";
  if (pattern === "^[A-Z]{3}$") return "USD";
  if (/postal|zip/i.test(pattern ?? "")) return "10001";
  return undefined;
}
function stringSample(schema) {
  const fromPattern = patternSample(schema.pattern);
  if (fromPattern) return fromPattern;
  if (schema.format === "uuid") return "00000000-0000-4000-8000-000000000001";
  if (schema.format === "date-time") return "2026-01-01T00:00:00Z";
  if (schema.format === "date") return "2026-01-01";
  if (schema.format === "email") return "user@example.com";
  if (schema.format === "uri" || schema.format === "url") return "https://example.com";
  let value = schema.title?.toLowerCase().includes("postal") ? "10001" : "example";
  if (schema.minLength) value = value.padEnd(schema.minLength, "x");
  if (schema.maxLength) value = value.slice(0, schema.maxLength);
  return value;
}
function sample(input, seen = new Set()) {
  if (!input) return {};
  if (input.example !== undefined) return input.example;
  if (Array.isArray(input.examples) && input.examples.length) return input.examples[0];
  if (input.default !== undefined) return input.default;
  if (input.const !== undefined) return input.const;
  if (input.enum?.length) return input.enum[0];
  if (input.$ref) {
    if (seen.has(input.$ref)) return {};
    const next = new Set(seen); next.add(input.$ref);
    return sample(refSchema(input), next);
  }
  if (input.allOf?.length) {
    const values = input.allOf.map((entry) => sample(entry, seen));
    return values.every((value) => value && typeof value === "object" && !Array.isArray(value))
      ? Object.assign({}, ...values) : values[0];
  }
  if (input.oneOf?.length) return sample(input.oneOf[0], seen);
  if (input.anyOf?.length) return sample(input.anyOf.find((entry) => entry.type !== "null") ?? input.anyOf[0], seen);
  if (input.type === "object" || input.properties) {
    const output = {};
    for (const name of input.required ?? []) {
      if (input.properties?.[name]) output[name] = sample(input.properties[name], seen);
    }
    return output;
  }
  if (input.type === "array") return [sample(input.items ?? {}, seen)];
  if (input.type === "integer" || input.type === "number") return input.minimum ?? 1;
  if (input.type === "boolean") return false;
  if (input.type === "string") return stringSample(input);
  return {};
}
function title(operation, method, path) {
  return operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`;
}
function folderName(path) {
  const parts = path.split("/").filter(Boolean);
  const api = parts[0] === "api" && /^v\d+$/.test(parts[1] ?? "") ? 2 : 0;
  return parts[api] || "root";
}
function securityHeaders(operation) {
  const security = operation.security ?? spec.security ?? [];
  return security.length ? [{ key: "Authorization", value: "Bearer {{bearer_token}}", type: "text" }] : [];
}
function requestFor(path, method, operation, pathItem) {
  const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];
  let raw = `{{base_url}}${path}`;
  const urlPath = path.split("/").filter(Boolean).map((segment) => {
    const match = segment.match(/^\{(.+)\}$/);
    if (!match) return segment;
    const parameter = parameters.find((entry) => entry.in === "path" && entry.name === match[1]);
    const value = variable(match[1], parameter?.example ?? sample(parameter?.schema));
    raw = raw.replace(`{${match[1]}}`, value);
    return value;
  });
  const query = [];
  const headers = securityHeaders(operation);
  for (const parameter of parameters.filter((entry) => entry.required)) {
    const value = variable(parameter.name, parameter.example ?? parameter.schema?.example ?? sample(parameter.schema));
    if (parameter.in === "query") query.push({ key: parameter.name, value });
    if (parameter.in === "header" && !headers.some((entry) => entry.key.toLowerCase() === parameter.name.toLowerCase())) {
      headers.push({ key: parameter.name, value, type: "text" });
    }
  }
  if (query.length) raw += "?" + query.map((entry) => `${encodeURIComponent(entry.key)}=${entry.value}`).join("&");
  const url = { raw, host: ["{{base_url}}"], path: urlPath };
  if (query.length) url.query = query;
  const request = {
    method: method.toUpperCase(),
    header: headers,
    url,
    description: `Source: apps/api/openapi.json\noperationId: ${operation.operationId ?? ""}`,
  };
  const json = operation.requestBody?.content?.["application/json"];
  if (json) {
    request.header.push({ key: "Content-Type", value: "application/json", type: "text" });
    request.body = { mode: "raw", raw: JSON.stringify(json.example !== undefined ? json.example : sample(json.schema), null, 2), options: { raw: { language: "json" } } };
  }
  return request;
}

const folders = new Map();
for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
  for (const method of methods) {
    const operation = pathItem[method];
    if (!operation) continue;
    const folder = folderName(path);
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder).push({ name: title(operation, method, path), request: requestFor(path, method, operation, pathItem) });
  }
}
const collection = {
  info: {
    name: "Breero API",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    description: "Generated deterministically from apps/api/openapi.json. OpenAPI defines operations, methods, security, parameters, folders, and request-body samples. No secrets embedded.",
  },
  variable: Array.from(variables.values()).sort((a, b) => a.key.localeCompare(b.key)),
  item: Array.from(folders.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, item]) => ({
    name,
    item: item.sort((a, b) => a.name.localeCompare(b.name)),
  })),
};
writeFileSync("postman/Breero-API.postman_collection.json", JSON.stringify(collection, null, 2) + "\n");

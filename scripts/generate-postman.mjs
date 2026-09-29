#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const spec = JSON.parse(readFileSync("apps/api/openapi.json", "utf8"));
const collection = JSON.parse(readFileSync("postman/Breero-API.postman_collection.json", "utf8"));
const methods = new Set(["get","post","put","patch","delete","options","head","trace"]);
const variables = new Map((collection.variable ?? []).map((entry) => [entry.key, entry]));

const variableKey = (name) => "param_" + String(name).replace(/[^A-Za-z0-9_]/g, "_");
function variable(name, example = "") {
  const key = variableKey(name);
  if (!variables.has(key)) variables.set(key, { key, value: String(example ?? "") });
  return `{{${key}}}`;
}
function sample(schema, seen = new Set()) {
  if (!schema) return {};
  if (schema.example !== undefined) return schema.example;
  if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.$ref) {
    if (seen.has(schema.$ref)) return {};
    const key = schema.$ref.split("/").pop();
    const next = new Set(seen); next.add(schema.$ref);
    return sample(spec.components?.schemas?.[key], next);
  }
  if (schema.allOf?.length) {
    const values = schema.allOf.map((entry) => sample(entry, seen));
    return values.every((value) => value && typeof value === "object" && !Array.isArray(value))
      ? Object.assign({}, ...values) : values[0];
  }
  if (schema.oneOf?.length) return sample(schema.oneOf[0], seen);
  if (schema.anyOf?.length) return sample(schema.anyOf.find((entry) => entry.type !== "null") ?? schema.anyOf[0], seen);
  if (schema.type === "object" || schema.properties) {
    const output = {};
    const required = new Set(schema.required ?? []);
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
      if (required.has(key)) output[key] = sample(value, seen);
    }
    return output;
  }
  if (schema.type === "array") return [sample(schema.items ?? {}, seen)];
  if (schema.type === "integer" || schema.type === "number") return schema.minimum ?? 1;
  if (schema.type === "boolean") return false;
  if (schema.type === "string") {
    if (schema.format === "uuid") return "00000000-0000-4000-8000-000000000001";
    if (schema.format === "date-time") return "2026-01-01T00:00:00Z";
    if (schema.format === "date") return "2026-01-01";
    if (schema.format === "email") return "user@example.com";
    if (schema.format === "uri" || schema.format === "url") return "https://example.com";
    return schema.minLength > 5 ? "example".padEnd(schema.minLength, "x") : "example";
  }
  return {};
}

const operations = new Map();
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  for (const [method, operation] of Object.entries(item ?? {})) {
    if (!methods.has(method) || !operation?.operationId) continue;
    operations.set(operation.operationId, { path, operation, pathParameters: item.parameters ?? [] });
  }
}
function walk(items) {
  for (const item of items ?? []) {
    if (item.item) { walk(item.item); continue; }
    const request = item.request;
    const operationId = request?.description?.match(/operationId:\s*([^\s]+)/)?.[1];
    const meta = operationId && operations.get(operationId);
    if (!request || !meta) continue;
    const required = [...meta.pathParameters, ...(meta.operation.parameters ?? [])].filter((entry) => entry?.required);
    let raw = `{{base_url}}${meta.path}`;
    request.url ??= {};
    request.url.host = ["{{base_url}}"];
    request.url.path = meta.path.split("/").filter(Boolean).map((segment) => {
      const match = segment.match(/^\{(.+)\}$/);
      if (!match) return segment;
      const value = variable(match[1]);
      raw = raw.replace(`{${match[1]}}`, value);
      return value;
    });
    const query = [];
    const headers = (request.header ?? []).filter((entry) => entry.key !== "Content-Type");
    for (const parameter of required) {
      if (parameter.in === "query") query.push({ key: parameter.name, value: variable(parameter.name, parameter.example ?? parameter.schema?.example ?? sample(parameter.schema)) });
      if (parameter.in === "header" && !headers.some((entry) => entry.key.toLowerCase() === parameter.name.toLowerCase())) {
        headers.push({ key: parameter.name, value: variable(parameter.name, parameter.example ?? parameter.schema?.example ?? sample(parameter.schema)), type: "text" });
      }
    }
    if (query.length) {
      request.url.query = query;
      raw += "?" + query.map((entry) => `${encodeURIComponent(entry.key)}=${entry.value}`).join("&");
    } else delete request.url.query;
    request.url.raw = raw;
    const json = meta.operation.requestBody?.content?.["application/json"];
    if (json) {
      request.body = { mode: "raw", raw: JSON.stringify(json.example !== undefined ? json.example : sample(json.schema), null, 2), options: { raw: { language: "json" } } };
      if (!headers.some((entry) => entry.key.toLowerCase() === "content-type")) headers.push({ key: "Content-Type", value: "application/json", type: "text" });
    }
    request.header = headers;
  }
}
walk(collection.item);
collection.variable = Array.from(variables.values()).sort((a, b) => a.key.localeCompare(b.key));
collection.info.description = "Generated deterministically from apps/api/openapi.json. Required path/query/header parameters and schema-valid JSON placeholders are preserved. No secrets embedded.";
writeFileSync("postman/Breero-API.postman_collection.json", JSON.stringify(collection, null, 2) + "\n");

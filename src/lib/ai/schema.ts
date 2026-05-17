import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { AlchemyOutput } from "./types.js";

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "symbol",
    "timeframe",
    "mode",
    "macro_bias",
    "technical_bias",
    "liquidity_state",
    "setup_type",
    "confidence",
    "risk_score",
    "data_quality",
    "action_class",
    "execution_allowed",
    "journal_required",
    "failed_gate",
    "entry_plan",
    "conflict_flags",
    "notes",
  ],
  properties: {
    symbol: { type: "string" },
    timeframe: { type: "string" },
    mode: { type: "string" },
    macro_bias: { type: "string" },
    technical_bias: { type: "string" },
    liquidity_state: { type: "string" },
    setup_type: { type: "string" },
    confidence: { type: "number" },
    risk_score: { type: "number" },
    data_quality: { type: "number" },
    action_class: { type: "string" },
    execution_allowed: { type: "boolean" },
    journal_required: { type: "boolean" },
    failed_gate: { type: ["string", "null"] },
    entry_plan: {
      type: "object",
      additionalProperties: false,
      required: ["entry", "stop", "targets"],
      properties: {
        entry: { type: "string" },
        stop: { type: "string" },
        targets: { type: "array", items: { type: "string" } },
      },
    },
    conflict_flags: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
};

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export const validateAlchemyOutput = ajv.compile<AlchemyOutput>(schema);
export const alchemySchema = schema;

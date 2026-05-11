import { z } from "zod";

const envSchema = z.object({
  CF_API_TOKEN: z.string().min(1, "CF_API_TOKEN is required"),
  CF_ACCOUNT_ID: z.string().min(1, "CF_ACCOUNT_ID is required"),
  CF_DASHBOARD_USER: z.string().min(1, "CF_DASHBOARD_USER is required"),
  CF_DASHBOARD_PASS: z.string().min(1, "CF_DASHBOARD_PASS is required"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

function getEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify(parsed.error.format(), null, 2)}`
    );
  }
  return parsed.data;
}

// Lazy singleton — evaluated on first request, not at module import time
let _env: ReturnType<typeof getEnv> | null = null;
export function env() {
  if (!_env) _env = getEnv();
  return _env;
}


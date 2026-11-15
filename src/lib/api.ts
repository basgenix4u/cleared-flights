import { ZodError } from "zod";
import { ProviderError } from "./providers/types";
import { json, log } from "./security";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown, requestId?: string) {
  const rid = requestId ? { requestId } : {};
  if (e instanceof ApiError) return json({ error: { code: e.code, message: e.message, ...rid, ...e.extra } }, e.status);
  if (e instanceof ProviderError)
    return json({ error: { code: e.code, message: e.message, retryable: e.retryable, ...rid } }, e.httpStatus);
  if (e instanceof ZodError)
    return json(
      {
        error: {
          code: "VALIDATION",
          message: "Some details need attention",
          ...rid,
          fields: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      400,
    );
  log("error", "api.unhandled", { message: e instanceof Error ? e.message : String(e), requestId });
  return json(
    { error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again.", ...rid } },
    500,
  );
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "Request body must be JSON");
  }
}

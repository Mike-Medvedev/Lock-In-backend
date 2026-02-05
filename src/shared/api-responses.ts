import z from "zod";

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  statusCode: number;
  name: string;
  message: string;
  detail?: unknown;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const SuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ErrorSchema = z.object({
  success: z.literal(false),
  statusCode: z.number(),
  name: z.string(),
  message: z.string(),
  detail: z.any().optional(),
});

export function SuccessApiResponse<T>(data: T): ApiSuccess<T> {
  return {
    success: true,
    data,
  };
}

export function ErrorApiResponse(statusCode: number, error: Error, detail?: unknown): ApiError {
  return {
    success: false,
    statusCode,
    name: error.name,
    message: error.message,
    ...(detail !== undefined && { detail }),
  };
}

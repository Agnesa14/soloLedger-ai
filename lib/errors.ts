type ErrorWithMessage = {
  message?: string;
};

type ErrorWithStatus = ErrorWithMessage & {
  status?: number;
  response?: {
    status?: number;
    data?: unknown;
  };
};

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;

  const maybeError = error as ErrorWithMessage | null;
  if (maybeError?.message) return maybeError.message;

  return fallback;
}

export function getErrorStatus(error: unknown) {
  const maybeError = error as ErrorWithStatus | null;
  return maybeError?.status ?? maybeError?.response?.status ?? 500;
}

export function hasMessage(error: unknown, fragment: string) {
  return getErrorMessage(error, "").toLowerCase().includes(fragment.toLowerCase());
}

function sanitize(message: string): string {
  let output = message;
  const token = process.env.DISCORD_TOKEN;
  if (token && token.length >= 8) {
    output = output.split(token).join('[redacted]');
  }
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (clientId && clientId.length >= 8) {
    output = output.split(clientId).join('[redacted]');
  }
  return output.replace(/[\w-]{20,}\.[\w-]{6}\.[\w-]{20,}/g, '[redacted]');
}

function details(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ? `${error.name}: ${error.message}\n${error.stack}` : `${error.name}: ${error.message}`;
  }
  return String(error);
}

export const logger = {
  info(message: string): void {
    console.log(`[INFO] ${sanitize(message)}`);
  },
  warn(message: string): void {
    console.warn(`[WARN] ${sanitize(message)}`);
  },
  error(message: string, error?: unknown): void {
    console.error(`[ERROR] ${sanitize(message)}`);
    if (error !== undefined) {
      console.error(sanitize(details(error)));
    }
  },
};

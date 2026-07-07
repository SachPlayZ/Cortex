export function requireBearerToken(request: Request, envVar: string): Response | undefined {
  const token = process.env[envVar];
  if (!token) {
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: `${envVar} not configured` }, { status: 503 });
    }
    return undefined;
  }
  if (request.headers.get("authorization") === `Bearer ${token}`) return undefined;
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

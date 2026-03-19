export class DoApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly endpoint: string,
  ) {
    super(`DO API error ${status} on ${endpoint}: ${body.slice(0, 200)}`);
    this.name = "DoApiError";
  }
}

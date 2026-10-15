/** Preserve protocol query values before NextRequest's NextURL-derived url getter. */
export function originalRequestUrl(request: Request): URL {
  // NextRequest extends the native Request, whose URL still holds the unmodified
  // request input. Reading its getter neither trusts forwarding headers nor touches the body.
  return new URL(Reflect.get(Request.prototype, 'url', request) as string);
}

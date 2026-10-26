let adminToken: string | null = null;

export function setAdminToken(token: string | null): void {
  adminToken = token;
}

export function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (adminToken) {
    headers.set('Authorization', `Bearer ${adminToken}`);
  }
  return fetch(input, { ...init, headers });
}

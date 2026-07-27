import { AuthClient } from '../../services';

let _authClient: AuthClient | null = null;

export function getAuthClient(): AuthClient {
  if (!_authClient) {
    _authClient = new AuthClient();
  }
  return _authClient;
}

export async function getToken(): Promise<string> {
  return getAuthClient().getToken();
}

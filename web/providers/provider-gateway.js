export class ProviderGateway {
  constructor({ baseUrl = '/api/mail', fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('Provider gateway requires a fetch implementation.');
    }

    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  async request(path, { method = 'GET', body, signal } = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const error = new Error(`Mail gateway request failed with status ${response.status}.`);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }
}

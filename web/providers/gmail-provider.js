import { GatewayMailProvider } from './gateway-mail-provider.js';

export class GmailMailProvider extends GatewayMailProvider {
  constructor({ accountId, gateway }) {
    super({ accountId, gateway });
  }
}

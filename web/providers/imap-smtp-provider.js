import { GatewayMailProvider } from './gateway-mail-provider.js';

export class ImapSmtpMailProvider extends GatewayMailProvider {
  constructor({ accountId, gateway }) {
    super({ accountId, gateway });
  }
}

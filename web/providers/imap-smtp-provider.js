import { GatewayMailProvider } from './gateway-mail-provider.js';

export class ImapSmtpMailProvider extends GatewayMailProvider {
  constructor({ gateway }) {
    super({ providerId: 'imap-smtp', gateway });
  }
}

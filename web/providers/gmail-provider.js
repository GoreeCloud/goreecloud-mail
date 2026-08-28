import { GatewayMailProvider } from './gateway-mail-provider.js';

export class GmailMailProvider extends GatewayMailProvider {
  constructor({ gateway }) {
    super({ providerId: 'gmail', gateway });
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';

import { GmailApiClient } from '../server/gmail-api-client.js';
import { PROVIDER_ERROR_CODES } from '../web/providers/provider-error.js';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

test('Gmail API client resolves token server-side and sends bearer authorization', async () => {
  const calls = [];
  const client = new GmailApiClient({
    tokenResolver: async (context) => {
      assert.deepEqual(context, { userId: 'u1', accountId: 'a1' });
      return 'server-only-token';
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ labels: [{ id: 'INBOX', name: 'INBOX', type: 'system' }] });
    },
  });

  const labels = await client.listLabels({ userId: 'u1', accountId: 'a1' });
  assert.equal(labels[0].id, 'INBOX');
  assert.equal(calls[0].options.headers.authorization, 'Bearer server-only-token');
  assert.doesNotMatch(JSON.stringify(labels), /server-only-token/);
});

test('Gmail API listMessages clamps result count and preserves pagination metadata', async () => {
  const client = new GmailApiClient({
    tokenResolver: async () => 'token',
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      assert.equal(parsed.searchParams.get('maxResults'), '100');
      assert.deepEqual(parsed.searchParams.getAll('labelIds'), ['INBOX', 'STARRED']);
      return jsonResponse({
        messages: [{ id: 'm1', threadId: 't1' }],
        nextPageToken: 'next',
        resultSizeEstimate: 1,
      });
    },
  });

  const result = await client.listMessages({}, { labelIds: ['INBOX', 'STARRED'], maxResults: 999 });
  assert.deepEqual(result.messageRefs, [{ id: 'm1', threadId: 't1' }]);
  assert.equal(result.nextPageToken, 'next');
});

test('Gmail API failures become normalized provider errors without response-body leakage', async () => {
  const client = new GmailApiClient({
    tokenResolver: async () => 'token',
    fetchImpl: async () => jsonResponse({ error: { message: 'sensitive upstream details' } }, 429),
  });

  await assert.rejects(
    () => client.listLabels({}),
    (error) => error.code === PROVIDER_ERROR_CODES.RATE_LIMITED && !/sensitive upstream details/.test(error.message),
  );
});

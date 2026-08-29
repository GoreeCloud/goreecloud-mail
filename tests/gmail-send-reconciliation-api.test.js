import test from 'node:test';
import assert from 'node:assert/strict';

import { GmailApiClient } from '../server/gmail-api-client.js';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get() { return null; } },
    async json() { return body; },
  };
}

test('Gmail reconciliation lookup searches sent mail by exact RFC Message-ID and is bounded', async () => {
  const messageId = '<goreecloud-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef@mail.goreecloud.invalid>';
  const client = new GmailApiClient({
    tokenResolver: async () => 'token',
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      assert.equal(parsed.pathname, '/gmail/v1/users/me/messages');
      assert.equal(parsed.searchParams.get('q'), `in:sent rfc822msgid:${messageId}`);
      assert.equal(parsed.searchParams.get('maxResults'), '2');
      return jsonResponse({
        messages: [{ id: 'sent-1', threadId: 'thread-1' }],
        resultSizeEstimate: 1,
      });
    },
  });

  const matches = await client.findSentMessageByRfcMessageId({}, { messageId });
  assert.deepEqual(matches, [{ id: 'sent-1', threadId: 'thread-1' }]);
});

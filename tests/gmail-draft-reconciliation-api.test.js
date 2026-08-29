import test from 'node:test';
import assert from 'node:assert/strict';

import { GmailApiClient } from '../server/gmail-api-client.js';

function okJson(payload) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    async json() { return payload; },
  };
}

test('Gmail draft reconciliation lookup is bounded and returns normalized draft references', async () => {
  const requests = [];
  const client = new GmailApiClient({
    tokenResolver: async () => 'token',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return okJson({
        drafts: [
          { id: 'draft-1', message: { id: 'message-1', threadId: 'thread-1' } },
        ],
      });
    },
    requestPolicy: async (operation) => operation({ signal: undefined }),
  });

  const messageId = '<goreecloud-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@mail.goreecloud.invalid>';
  const result = await client.findDraftByRfcMessageId({ accountId: 'account-1' }, { messageId });

  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.pathname, '/gmail/v1/users/me/drafts');
  assert.equal(requestUrl.searchParams.get('q'), `rfc822msgid:${messageId}`);
  assert.equal(requestUrl.searchParams.get('maxResults'), '2');
  assert.equal(requests[0].options.method, 'GET');
  assert.deepEqual(result, [
    { id: 'draft-1', message: { id: 'message-1', threadId: 'thread-1' } },
  ]);
});

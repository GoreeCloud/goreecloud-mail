function requiredText(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

function replySubject(subject) {
  const normalized = requiredText(subject, 'message subject');
  return /^re\s*:/i.test(normalized) ? normalized : `Re: ${normalized}`;
}

function forwardSubject(subject) {
  const normalized = requiredText(subject, 'message subject');
  return /^(?:fwd?|forward)\s*:/i.test(normalized) ? normalized : `Fwd: ${normalized}`;
}

function quotePlainText(body) {
  return String(body ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

export function buildReplyCompose(message, formattedDate) {
  const sender = requiredText(message?.sender, 'sender name');
  const address = requiredText(message?.address, 'sender address');
  const date = requiredText(formattedDate, 'formatted message date');
  return {
    to: address,
    subject: replySubject(message?.subject),
    body: `\n\nOn ${date}, ${sender} <${address}> wrote:\n${quotePlainText(message?.body)}`,
  };
}

export function buildForwardCompose(message, formattedDate) {
  const sender = requiredText(message?.sender, 'sender name');
  const address = requiredText(message?.address, 'sender address');
  const subject = requiredText(message?.subject, 'message subject');
  const date = requiredText(formattedDate, 'formatted message date');
  return {
    to: '',
    subject: forwardSubject(subject),
    body: [
      '',
      '',
      '---------- Forwarded message ----------',
      `From: ${sender} <${address}>`,
      `Date: ${date}`,
      `Subject: ${subject}`,
      '',
      String(message?.body ?? ''),
    ].join('\n'),
  };
}

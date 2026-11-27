const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');
const axios = require('axios');
const db = require('../src/config/db');
const env = require('../src/config/env');

const {
  parseWebhookTarget,
  isUnsafeIpAddress,
  resolveAndPinWebhookTarget,
  createPinnedLookup,
} = require('../src/utils/webhookTarget');
const { attemptDelivery } = require('../src/services/webhookSender');

describe('webhook target URL validation', () => {
  it('accepts an HTTPS target with a public IPv4 literal', async () => {
    const target = await resolveAndPinWebhookTarget('https://8.8.8.8/hooks', {
      nodeEnv: 'production',
    });
    assert.equal(target.address, '8.8.8.8');
    assert.equal(target.addressFamily, 4);
    assert.equal(target.url.pathname, '/hooks');
  });

  it('accepts a public DNS target and returns its resolved address', async () => {
    const target = await resolveAndPinWebhookTarget('https://hooks.example.com/events', {
      nodeEnv: 'production',
      lookup: async (hostname, options) => {
        assert.equal(hostname, 'hooks.example.com');
        assert.deepEqual(options, { all: true, verbatim: true });
        return [{ address: '93.184.216.34', family: 4 }];
      },
    });
    assert.equal(target.address, '93.184.216.34');
    assert.equal(target.hostname, 'hooks.example.com');
  });

  it('requires HTTPS in production while allowing HTTP in non-production', async () => {
    assert.throws(
      () => parseWebhookTarget('http://hooks.example.com', { nodeEnv: 'production' }),
      { code: 'ERR_WEBHOOK_TARGET_REJECTED' }
    );
    const target = await resolveAndPinWebhookTarget('http://hooks.example.com', {
      nodeEnv: 'development',
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    });
    assert.equal(target.url.protocol, 'http:');
  });

  it('rejects localhost names without attempting DNS', async () => {
    for (const hostname of ['localhost', 'api.localhost', 'printer.local', 'db.internal']) {
      await assert.rejects(
        resolveAndPinWebhookTarget(`https://${hostname}/hook`, {
          lookup: async () => { throw new Error('DNS must not be called'); },
        }),
        { code: 'ERR_WEBHOOK_TARGET_REJECTED' }
      );
    }
  });

  it('rejects private IPv4 and unsafe IPv6 literals in URLs', () => {
    for (const target of [
      'https://127.0.0.1/hook',
      'https://10.0.0.8/hook',
      'https://169.254.169.254/latest/meta-data',
      'https://[::1]/hook',
      'https://[fd00::1]/hook',
      'https://[::ffff:127.0.0.1]/hook',
    ]) {
      assert.throws(() => parseWebhookTarget(target), {
        code: 'ERR_WEBHOOK_TARGET_REJECTED',
      }, `${target} should be blocked`);
    }
  });

  it('blocks unsafe IPv4 ranges', () => {
    for (const address of [
      '0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254',
      '172.16.0.1', '192.0.2.1', '192.168.1.1', '198.18.0.1',
      '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255',
    ]) assert.equal(isUnsafeIpAddress(address), true, `${address} should be blocked`);

    assert.equal(isUnsafeIpAddress('8.8.8.8'), false);
    assert.equal(isUnsafeIpAddress('93.184.216.34'), false);
  });

  it('blocks unsafe IPv6 ranges and allows global unicast', () => {
    for (const address of [
      '::', '::1', '::ffff:127.0.0.1', '64:ff9b::a00:1', '100::1',
      '2001:db8::1', '2002::1', '3fff::1', 'fc00::1', 'fd00::1', 'fe80::1', 'ff02::1',
    ]) assert.equal(isUnsafeIpAddress(address), true, `${address} should be blocked`);

    assert.equal(isUnsafeIpAddress('2001:4860:4860::8888'), false);
  });

  it('rejects DNS answers if any address is unsafe', async () => {
    await assert.rejects(
      resolveAndPinWebhookTarget('https://mixed.example.com/hook', {
        nodeEnv: 'production',
        lookup: async () => [
          { address: '93.184.216.34', family: 4 },
          { address: '10.0.0.8', family: 4 },
        ],
      }),
      { code: 'ERR_WEBHOOK_TARGET_REJECTED' }
    );
  });

  it('pins future socket lookups to the validated address without DNS re-resolution', async () => {
    let dnsCalls = 0;
    const target = await resolveAndPinWebhookTarget('https://rebind.example.com/hook', {
      nodeEnv: 'production',
      lookup: async () => {
        dnsCalls += 1;
        return [{ address: '93.184.216.34', family: 4 }];
      },
    });
    const pinnedLookup = createPinnedLookup(target.hostname, target.address, target.addressFamily);

    const answer = await new Promise((resolve, reject) => {
      pinnedLookup('rebind.example.com', { all: true }, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });

    assert.equal(dnsCalls, 1);
    assert.deepEqual(answer, [{ address: '93.184.216.34', family: 4 }]);
    assert.throws(() => createPinnedLookup('other.example.com', target.address, 4)
      ('rebind.example.com', {}, (err) => { if (err) throw err; }));
  });

  it('rejects unsupported protocols and URL credentials', () => {
    assert.throws(() => parseWebhookTarget('file:///etc/passwd'), {
      code: 'ERR_WEBHOOK_TARGET_REJECTED',
    });
    assert.throws(() => parseWebhookTarget('https://user:pass@hooks.example.com'), {
      code: 'ERR_WEBHOOK_TARGET_REJECTED',
    });
  });

  it('uses the pinned destination and bounded Axios options for delivery', async () => {
    const targetUrl = 'https://8.8.8.8/hooks';
    const originalTarget = env.webhookUrls['ticket.created'];
    const originalPost = axios.post;
    const originalQuery = db.query;
    let captured;
    env.webhookUrls['ticket.created'] = targetUrl;
    axios.post = async (_url, _body, options) => {
      captured = options;
      return { status: 204 };
    };
    db.query = async () => ({ rows: [] });

    try {
      const delivered = await attemptDelivery({
        id: 'event-1',
        event_type: 'ticket.created',
        payload: { event: 'ticket.created' },
        target_url: targetUrl,
        idempotency_key: 'event-key',
        attempts: 0,
      });

      assert.equal(delivered, true);
      assert.equal(captured.timeout, 10000);
      assert.equal(captured.maxRedirects, 0);
      assert.equal(captured.maxContentLength, 64 * 1024);
      assert.equal(captured.maxBodyLength, 2 * 1024 * 1024);
      assert.equal(captured.proxy, false);
      assert.equal(typeof captured.httpsAgent.options.lookup, 'function');
      const pinned = await new Promise((resolve, reject) => {
        captured.httpsAgent.options.lookup('8.8.8.8', { all: true }, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      assert.deepEqual(pinned, [{ address: '8.8.8.8', family: 4 }]);
    } finally {
      env.webhookUrls['ticket.created'] = originalTarget;
      axios.post = originalPost;
      db.query = originalQuery;
    }
  });
});

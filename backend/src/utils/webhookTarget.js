const dns = require('node:dns').promises;
const net = require('node:net');

const blockedIPv4 = new net.BlockList();
[
  ['0.0.0.0', 8],       // Current network / unspecified
  ['10.0.0.0', 8],      // Private
  ['100.64.0.0', 10],   // Shared address space
  ['127.0.0.0', 8],     // Loopback
  ['169.254.0.0', 16],  // Link-local / cloud metadata
  ['172.16.0.0', 12],   // Private
  ['192.0.0.0', 24],    // IETF protocol assignments
  ['192.0.2.0', 24],    // Documentation
  ['192.88.99.0', 24],  // Deprecated 6to4 relay anycast
  ['192.168.0.0', 16],  // Private
  ['198.18.0.0', 15],   // Benchmarking
  ['198.51.100.0', 24], // Documentation
  ['203.0.113.0', 24],  // Documentation
  ['224.0.0.0', 4],     // Multicast
  ['240.0.0.0', 4],     // Reserved / broadcast
].forEach(([subnet, prefix]) => blockedIPv4.addSubnet(subnet, prefix, 'ipv4'));

const globalIPv6 = new net.BlockList();
globalIPv6.addSubnet('2000::', 3, 'ipv6'); // Global unicast allocation

const blockedIPv6 = new net.BlockList();
[
  ['::', 128],          // Unspecified
  ['::1', 128],         // Loopback
  ['::', 96],           // IPv4-compatible (deprecated)
  ['::ffff:0:0', 96],   // IPv4-mapped
  ['64:ff9b::', 96],    // NAT64 well-known prefix
  ['64:ff9b:1::', 48],  // NAT64 local-use prefix
  ['100::', 64],        // Discard-only
  ['2001::', 23],       // IETF protocol assignments (includes Teredo/ORCHID)
  ['2001:2::', 48],     // Benchmarking
  ['2001:db8::', 32],   // Documentation
  ['2002::', 16],       // 6to4
  ['3fff::', 20],       // Documentation
  ['fc00::', 7],        // Unique-local
  ['fe80::', 10],       // Link-local
  ['ff00::', 8],        // Multicast
].forEach(([subnet, prefix]) => blockedIPv6.addSubnet(subnet, prefix, 'ipv6'));

function unsafeTargetError(message = 'webhook target is not allowed') {
  const error = new Error(message);
  error.code = 'ERR_WEBHOOK_TARGET_REJECTED';
  return error;
}

function normalizeHostname(hostname) {
  return String(hostname || '').replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

function parseWebhookTarget(value, { nodeEnv = process.env.NODE_ENV || 'development' } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw unsafeTargetError('webhook target must be an absolute URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw unsafeTargetError('webhook target must use HTTP or HTTPS');
  }
  if (nodeEnv === 'production' && url.protocol !== 'https:') {
    throw unsafeTargetError('webhook targets must use HTTPS in production');
  }
  if (url.username || url.password) {
    throw unsafeTargetError('webhook target must not contain URL credentials');
  }

  const hostname = normalizeHostname(url.hostname);
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')
      || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw unsafeTargetError();
  }

  const family = net.isIP(hostname);
  if (family && isUnsafeIpAddress(hostname)) throw unsafeTargetError();
  return { url, hostname, family };
}

function isUnsafeIpAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return blockedIPv4.check(address, 'ipv4');
  if (family === 6) {
    return !globalIPv6.check(address, 'ipv6') || blockedIPv6.check(address, 'ipv6');
  }
  return true;
}

async function resolveAndPinWebhookTarget(value, {
  nodeEnv = process.env.NODE_ENV || 'development',
  lookup = dns.lookup,
} = {}) {
  const parsed = parseWebhookTarget(value, { nodeEnv });
  const addresses = parsed.family
    ? [{ address: parsed.hostname, family: parsed.family }]
    : await lookup(parsed.hostname, { all: true, verbatim: true });

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw Object.assign(new Error('webhook target did not resolve'), { code: 'ENOTFOUND' });
  }

  // Reject mixed public/private DNS answers too, so a later address-selection
  // change cannot make a private answer reachable.
  if (addresses.some(({ address }) => isUnsafeIpAddress(address))) {
    throw unsafeTargetError();
  }

  const selected = addresses[0];
  return {
    ...parsed,
    address: selected.address,
    addressFamily: selected.family || net.isIP(selected.address),
  };
}

function createPinnedLookup(targetHostname, address, addressFamily) {
  const expectedHostname = normalizeHostname(targetHostname);
  return (hostname, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    if (normalizeHostname(hostname) !== expectedHostname) {
      const error = new Error('unexpected hostname during webhook connection');
      error.code = 'ERR_WEBHOOK_TARGET_REJECTED';
      callback(error);
      return;
    }

    if (options && options.all) {
      callback(null, [{ address, family: addressFamily }]);
      return;
    }
    callback(null, address, addressFamily);
  };
}

module.exports = {
  parseWebhookTarget,
  isUnsafeIpAddress,
  resolveAndPinWebhookTarget,
  createPinnedLookup,
};

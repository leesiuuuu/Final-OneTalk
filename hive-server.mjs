import crypto from 'node:crypto';

const MATCH_HOSTS = {
  sandbox: 'https://sandbox-api-match.withhive.com',
  live: 'https://api-match.withhive.com',
};

const LEADERBOARD_HOSTS = {
  sandbox: 'https://sandbox-api-leaderboard.withhive.com',
  live: 'https://api-leaderboard.withhive.com',
};

export function hiveConfig(env = process.env) {
  const mode = env.HIVE_MODE === 'live' ? 'live' : 'sandbox';
  const enabled = env.HIVE_ENABLED === 'true';
  return {
    enabled,
    mode,
    certificationKey: env.HIVE_CERTIFICATION_KEY ?? '',
    gameIndex: env.HIVE_GAME_INDEX ?? '',
    matchId: env.HIVE_MATCH_ID ?? '',
    leaderboardId: env.HIVE_LEADERBOARD_ID ?? '',
    callbackSecret: env.HIVE_CALLBACK_SECRET ?? '',
  };
}

function requireFields(config, fields) {
  const missing = fields.filter(field => !config[field]);
  if (missing.length) throw new Error(`Hive 설정 누락: ${missing.join(', ')}`);
}

async function hiveFetch(url, config, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.certificationKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.message ?? `Hive API 오류 (${response.status})`);
  return data;
}

export async function requestHiveMatch(player, config = hiveConfig()) {
  requireFields(config, ['certificationKey', 'gameIndex', 'matchId']);
  const host = MATCH_HOSTS[config.mode];
  return hiveFetch(`${host}/gameindexes/${config.gameIndex}/matchmakings/${config.matchId}/players`, config, {
    method: 'POST',
    body: JSON.stringify({
      playerId: player.playerId,
      point: Math.round(player.rating ?? 1000),
      extraData: JSON.stringify({ nickname: player.nickname, difficulty: player.difficulty }),
    }),
  });
}

export async function submitHiveScore(playerId, score, extraData, config = hiveConfig()) {
  requireFields(config, ['certificationKey', 'leaderboardId']);
  const host = LEADERBOARD_HOSTS[config.mode];
  return hiveFetch(`${host}/leaderboards/${config.leaderboardId}/score`, config, {
    method: 'POST',
    body: JSON.stringify({
      playerId,
      score: Math.max(0, Math.min(1100, Math.round(score))),
      achievementTimeUtc: new Date().toISOString(),
      extraData: JSON.stringify(extraData ?? {}),
    }),
  });
}

export async function getHiveRanks(playerId, config = hiveConfig()) {
  requireFields(config, ['certificationKey', 'leaderboardId']);
  const host = LEADERBOARD_HOSTS[config.mode];
  const params = new URLSearchParams({ page: '1', rowcount: '20' });
  if (playerId) params.set('playerid', playerId);
  return hiveFetch(`${host}/leaderboards/${config.leaderboardId}/ranks?${params}`, config);
}

export function verifyHiveSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}


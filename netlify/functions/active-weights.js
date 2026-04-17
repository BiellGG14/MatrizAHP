const { createClient } = require('@libsql/client');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function client() {
  return createClient({ url: process.env.TURSO_URL, authToken: process.env.TURSO_TOKEN });
}

async function ensureTable(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS active_weights (
    id TEXT PRIMARY KEY,
    timestamp TEXT,
    calibrations_included TEXT,
    weights TEXT,
    activated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  const db = client();
  try {
    await ensureTable(db);

    if (event.httpMethod === 'GET') {
      const result = await db.execute('SELECT * FROM active_weights ORDER BY activated_at DESC LIMIT 1');
      const r = result.rows[0] || null;
      const row = r ? {
        id: r.id,
        timestamp: r.timestamp,
        calibrationsIncluded: JSON.parse(r.calibrations_included || '[]'),
        weights: JSON.parse(r.weights || '{}'),
      } : null;
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(row) };
    }

    if (event.httpMethod === 'POST') {
      const { id, timestamp, calibrationsIncluded, weights } = JSON.parse(event.body);
      await db.execute({
        sql: `INSERT OR REPLACE INTO active_weights (id, timestamp, calibrations_included, weights) VALUES (?, ?, ?, ?)`,
        args: [id, timestamp, JSON.stringify(calibrationsIncluded), JSON.stringify(weights)],
      });
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message }) };
  }
};

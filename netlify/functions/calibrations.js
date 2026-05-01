const { createClient } = require('@libsql/client');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function client() {
  return createClient({ url: process.env.TURSO_URL, authToken: process.env.TURSO_TOKEN });
}

async function ensureTable(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS calibrations (
    id TEXT PRIMARY KEY,
    timestamp TEXT,
    respondent_name TEXT,
    respondent_institution TEXT,
    respondent_formacao TEXT,
    respondent_municipio TEXT,
    respondent_setor TEXT,
    respondent_cargo TEXT,
    weights TEXT,
    raw_answers TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  try { await db.execute(`ALTER TABLE calibrations ADD COLUMN respondent_setor TEXT`); } catch (e) {}
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  const db = client();
  try {
    await ensureTable(db);

    if (event.httpMethod === 'GET') {
      const result = await db.execute('SELECT * FROM calibrations ORDER BY created_at DESC');
      const rows = result.rows.map(r => ({
        id: r.id,
        method: 'AHP-Express',
        timestamp: r.timestamp,
        respondent: {
          name: r.respondent_name,
          institution: r.respondent_institution,
          formacao: r.respondent_formacao,
          municipio: r.respondent_municipio,
          setor: r.respondent_setor,
          cargo: r.respondent_cargo,
        },
        weights: JSON.parse(r.weights || '{}'),
        rawAnswers: JSON.parse(r.raw_answers || '{}'),
      }));
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(rows) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { id, timestamp, respondent, weights, rawAnswers } = body;
      await db.execute({
        sql: `INSERT INTO calibrations (id, timestamp, respondent_name, respondent_institution, respondent_formacao, respondent_municipio, respondent_setor, respondent_cargo, weights, raw_answers)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, timestamp, respondent.name, respondent.institution || '', respondent.formacao || '', respondent.municipio || '', respondent.setor || '', respondent.cargo || '', JSON.stringify(weights), JSON.stringify(rawAnswers)],
      });
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
    }

    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters && event.queryStringParameters.id;
      if (!id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'id required' }) };
      await db.execute({ sql: 'DELETE FROM calibrations WHERE id = ?', args: [id] });
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message }) };
  }
};

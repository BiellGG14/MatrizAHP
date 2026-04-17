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
  await db.execute(`CREATE TABLE IF NOT EXISTS avaliacoes (
    id TEXT PRIMARY KEY,
    timestamp TEXT,
    respondent_name TEXT,
    respondent_municipio TEXT,
    respondent_estado TEXT,
    respondent_formacao TEXT,
    indice TEXT,
    level TEXT,
    dim_scores TEXT,
    answers TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  const db = client();
  try {
    await ensureTable(db);

    if (event.httpMethod === 'GET') {
      const result = await db.execute('SELECT * FROM avaliacoes ORDER BY created_at DESC');
      const rows = result.rows.map(r => ({
        id: r.id,
        timestamp: r.timestamp,
        respondent: {
          name: r.respondent_name,
          municipio: r.respondent_municipio,
          estado: r.respondent_estado,
          formacao: r.respondent_formacao,
        },
        indice: r.indice,
        level: r.level,
        dimScores: JSON.parse(r.dim_scores || '{}'),
        answers: JSON.parse(r.answers || '{}'),
      }));
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(rows) };
    }

    if (event.httpMethod === 'POST') {
      const { id, timestamp, respondent, indice, level, dimScores, answers } = JSON.parse(event.body);
      await db.execute({
        sql: `INSERT INTO avaliacoes (id, timestamp, respondent_name, respondent_municipio, respondent_estado, respondent_formacao, indice, level, dim_scores, answers)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, timestamp, respondent.name, respondent.municipio, respondent.estado, respondent.formacao || '', indice, level, JSON.stringify(dimScores), JSON.stringify(answers)],
      });
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
    }

    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters && event.queryStringParameters.id;
      if (!id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'id required' }) };
      await db.execute({ sql: 'DELETE FROM avaliacoes WHERE id = ?', args: [id] });
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message }) };
  }
};

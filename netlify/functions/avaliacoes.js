const { createClient } = require('@libsql/client');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const client = createClient({
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_TOKEN,
  });

  try {
    if (event.httpMethod === 'GET') {
      const result = await client.execute(
        'SELECT * FROM avaliacoes ORDER BY created_at DESC'
      );
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(result.rows),
      };
    }

    if (event.httpMethod === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body);
      } catch {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid JSON in request body' }),
        };
      }
      const { id, timestamp, respondent, indice, level, dim_scores, answers } = body;

      await client.execute({
        sql: `INSERT INTO avaliacoes
              (id, timestamp, respondent_name, respondent_municipio, respondent_estado, respondent_formacao, indice, level, dim_scores, answers)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          timestamp,
          respondent.name,
          respondent.municipio,
          respondent.estado,
          respondent.formacao,
          indice,
          level,
          JSON.stringify(dim_scores),
          JSON.stringify(answers),
        ],
      });

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};

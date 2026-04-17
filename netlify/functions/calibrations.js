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
        'SELECT * FROM calibrations ORDER BY created_at DESC'
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
      const { id, timestamp, respondent, weights, raw_answers } = body;

      await client.execute({
        sql: `INSERT INTO calibrations
              (id, timestamp, respondent_name, respondent_institution, respondent_formacao, respondent_municipio, weights, raw_answers)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          timestamp,
          respondent.name,
          respondent.institution,
          respondent.formacao,
          respondent.municipio,
          JSON.stringify(weights),
          JSON.stringify(raw_answers),
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

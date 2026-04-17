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
        'SELECT * FROM active_weights ORDER BY activated_at DESC LIMIT 1'
      );
      const raw = result.rows[0] || null;
      const row = raw
        ? {
            ...raw,
            weights: JSON.parse(raw.weights),
            calibrations_included: JSON.parse(raw.calibrations_included),
          }
        : null;
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
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
      const { id, timestamp, calibrations_included, weights } = body;

      await client.execute({
        sql: `INSERT OR REPLACE INTO active_weights
              (id, timestamp, calibrations_included, weights)
              VALUES (?, ?, ?, ?)`,
        args: [
          id,
          timestamp,
          JSON.stringify(calibrations_included),
          JSON.stringify(weights),
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

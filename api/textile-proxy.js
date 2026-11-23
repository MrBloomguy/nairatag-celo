/**
 * @file api/textile-proxy.js
 * @description Serverless proxy for Textile FX API v2 requests.
 * Eliminates browser CORS preflight blocks (since Textile's serverless function returns 404 on OPTIONS).
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Rfq-Claim, x-textile-path');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path: endpointPath, ...queryParams } = req.query || {};
  const targetPath = endpointPath || req.headers['x-textile-path'] || 'rfq/request';
  const cleanPath = String(targetPath).replace(/^\//, '');

  const queryString = new URLSearchParams(queryParams).toString();
  const url = `https://api.textilecredit.com/v2/${cleanPath}${queryString ? `?${queryString}` : ''}`;

  try {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    if (req.headers['x-rfq-claim']) {
      headers['X-Rfq-Claim'] = req.headers['x-rfq-claim'];
    }

    let requestBody = undefined;
    if (req.method === 'POST') {
      if (typeof req.body === 'string') {
        requestBody = req.body;
      } else if (req.body && typeof req.body === 'object') {
        requestBody = JSON.stringify(req.body);
      }
    }

    const textileRes = await fetch(url, {
      method: req.method,
      headers,
      body: requestBody,
    });

    const data = await textileRes.json().catch(() => ({}));
    return res.status(textileRes.status).json(data);
  } catch (err) {
    console.error('[textile-proxy error]', err);
    return res.status(502).json({
      error: {
        code: 'textile_proxy_error',
        message: err.message || 'Failed to reach Textile API from serverless proxy.',
      },
    });
  }
}

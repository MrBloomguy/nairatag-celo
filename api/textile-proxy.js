/**
 * @file api/textile-proxy.js
 * @description Serverless proxy for Textile FX API v2 requests.
 * Eliminates browser CORS preflight blocks (since Textile's serverless ALB returns 404 on OPTIONS).
 */

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Rfq-Claim, x-textile-path, x-textile-endpoint');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Robustly extract target endpoint from req.url or headers
    const parsedUrl = new URL(req.url, 'http://localhost');
    const endpointParam = parsedUrl.searchParams.get('endpoint') || 
                          parsedUrl.searchParams.get('textile_endpoint') ||
                          (req.query && req.query.endpoint) ||
                          req.headers['x-textile-endpoint'] ||
                          req.headers['x-textile-path'];

    // If query path collided with Vercel's rewrite wildcard, fallback safely
    let targetEndpoint = endpointParam;
    if (!targetEndpoint || targetEndpoint === 'textile-proxy') {
      const pathParam = parsedUrl.searchParams.get('path');
      if (pathParam && pathParam !== 'textile-proxy') {
        targetEndpoint = pathParam;
      } else {
        targetEndpoint = 'rfq/request';
      }
    }

    const cleanEndpoint = String(targetEndpoint).replace(/^\//, '');
    const upstreamUrl = new URL(`https://api.textilecredit.com/v2/${cleanEndpoint}`);

    // Forward any extra query parameters from original request
    for (const [key, value] of parsedUrl.searchParams.entries()) {
      if (key !== 'endpoint' && key !== 'path' && key !== 'textile_endpoint') {
        upstreamUrl.searchParams.set(key, value);
      }
    }

    const upstreamHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'NairaTag-Celo-App/1.0',
    };

    if (req.headers.authorization) {
      upstreamHeaders['Authorization'] = req.headers.authorization;
    }
    if (req.headers['x-rfq-claim']) {
      upstreamHeaders['X-Rfq-Claim'] = req.headers['x-rfq-claim'];
    }

    let requestBody = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (typeof req.body === 'string') {
        requestBody = req.body;
      } else if (req.body && typeof req.body === 'object') {
        requestBody = JSON.stringify(req.body);
      }
    }

    const textileRes = await fetch(upstreamUrl.toString(), {
      method: req.method,
      headers: upstreamHeaders,
      body: requestBody,
    });

    const responseText = await textileRes.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return res.status(textileRes.status).json(responseData);
  } catch (err) {
    console.error('[textile-proxy error]', err);
    return res.status(502).json({
      error: {
        code: 'textile_proxy_error',
        message: err.message || 'Failed to reach Textile API from serverless proxy.',
        detail: String(err),
      },
    });
  }
}

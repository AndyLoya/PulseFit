const axios = require('axios');

function getBaseUrl() {
  return (process.env.NUTRITION_API_BASE_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, '');
}

function getTimeout() {
  const timeout = Number(process.env.NUTRITION_API_TIMEOUT_MS || 5000);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 5000;
}

async function request(path, { method = 'GET', params, body, authorization } = {}) {
  try {
    const response = await axios.request({
      baseURL: getBaseUrl(),
      url: path,
      method,
      params,
      data: body,
      timeout: getTimeout(),
      headers: authorization ? { authorization } : {},
      validateStatus: () => true
    });

    if (response.status >= 500) {
      return { status: 502, data: { error: 'Nutrition service unavailable' } };
    }

    return { status: response.status, data: response.data };
  } catch (error) {
    const upstreamError = new Error('Nutrition service is unavailable');
    upstreamError.status = 502;
    upstreamError.cause = error;
    throw upstreamError;
  }
}

module.exports = {
  searchFoods: params => request('/nutrition/search', { params }),
  macroBreakdown: (foodId, params) => request(`/nutrition/macro-breakdown/${encodeURIComponent(foodId)}`, { params }),
  createLog: (body, authorization) => request('/nutrition/logs', { method: 'POST', body, authorization }),
  login: body => request('/auth/login', { method: 'POST', body }),
  refresh: body => request('/auth/refresh', { method: 'POST', body })
};

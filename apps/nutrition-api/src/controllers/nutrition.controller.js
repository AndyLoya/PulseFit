const off = require('../services/open-food-facts.service');
const nutritionLogService = require('../services/nutrition-log.service');

function invalid(res, details) {
  return res.status(400).json({ error: 'Invalid input', details });
}

function positiveNumber(value, name, details, { min = 0.01, max = Number.MAX_SAFE_INTEGER, required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) details.push(`${name} is required`);
    return;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) details.push(`${name} must be a number between ${min} and ${max}`);
  return parsed;
}

exports.searchFoods = async (req, res, next) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    if (!query || query.length > 100) return invalid(res, ['query is required and must be at most 100 characters']);

    const details = [];
    const page = positiveNumber(req.query.page, 'page', details, { min: 1, max: 10000 });
    const pageSize = positiveNumber(req.query.pageSize, 'pageSize', details, { min: 1, max: 100 });
    if (details.length) return invalid(res, details);

    const products = await off.search(query, page ? Math.floor(page) : 1, pageSize ? Math.floor(pageSize) : 20);
    res.json({ query, source: 'Open Food Facts', count: products.length, products, fallback: products.length === 0 });
  } catch (error) {
    next(error);
  }
};

exports.macroBreakdown = async (req, res, next) => {
  try {
    const foodId = String(req.params.foodId || '').trim();
    if (!foodId || foodId.length > 200) return invalid(res, ['foodId is required and must be at most 200 characters']);

    const details = [];
    const quantityGrams = positiveNumber(req.query.quantityGrams, 'quantityGrams', details, { min: 0.01, max: 10000 }) ?? 100;
    if (details.length) return invalid(res, details);

    const product = await off.getProduct(foodId);
    if (!product) return res.status(404).json({ error: 'Food not found', details: ['No food was found for the supplied foodId, or the food service is unavailable'] });

    const factor = quantityGrams / 100;
    const macros = Object.fromEntries(Object.entries(product.nutrientsPer100g).map(([key, value]) => [key, Number((Number(value) * factor).toFixed(2))]));
    res.json({ foodId: product.foodId, name: product.name, quantityGrams, unit: 'g', macros });
  } catch (error) {
    next(error);
  }
};

exports.logFood = (req, res, next) => {
  try {
    const body = req.body;
    const details = [];
    if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid(res, ['Request body must be a JSON object']);

    if (typeof body.foodId !== 'string' || !body.foodId.trim() || body.foodId.length > 200) details.push('foodId is required and must be a string of at most 200 characters');
    positiveNumber(body.quantityGrams, 'quantityGrams', details, { min: 0.01, max: 10000, required: true });
    if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(body.mealType)) details.push('mealType must be one of: breakfast, lunch, dinner, snack');
    if (body.consumedAt !== undefined && (typeof body.consumedAt !== 'string' || Number.isNaN(Date.parse(body.consumedAt)))) details.push('consumedAt must be a valid ISO-8601 date string');
    if (details.length) return invalid(res, details);

    const log = nutritionLogService.create(req.user.sub || req.user.userId || 'unknown', {
      foodId: body.foodId.trim(),
      quantityGrams: Number(body.quantityGrams),
      mealType: body.mealType,
      consumedAt: body.consumedAt || new Date().toISOString()
    });
    res.status(201).json({ message: 'Food log created', log });
  } catch (error) {
    next(error);
  }
};

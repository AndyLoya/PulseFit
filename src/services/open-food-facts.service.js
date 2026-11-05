const axios = require('axios');

const baseUrl = () => (process.env.OPEN_FOOD_FACTS_BASE_URL || 'https://world.openfoodfacts.org').replace(/\/$/, '');
const timeout = () => Number(process.env.OPEN_FOOD_FACTS_TIMEOUT_MS || 5000);

async function search(query, page = 1, pageSize = 20) {
  try {
    const response = await axios.get(`${baseUrl()}/cgi/search.pl`, {
      params: { search_terms: query, search_simple: 1, action: 'process', json: 1, page, page_size: pageSize },
      timeout: timeout(),
      headers: { 'User-Agent': 'PulseFit-Nutrition-Service/1.0' },
      validateStatus: status => status >= 200 && status < 300
    });
    return (response.data.products || []).map(product => ({
      foodId: product.code || product._id,
      name: product.product_name || 'Unknown product',
      brand: product.brands || null,
      imageUrl: product.image_front_small_url || null
    })).filter(product => product.foodId);
  } catch (error) {
    console.warn('Open Food Facts search failed:', error.message);
    return [];
  }
}

async function getProduct(foodId) {
  try {
    const response = await axios.get(`${baseUrl()}/api/v2/product/${encodeURIComponent(foodId)}`, {
      timeout: timeout(),
      headers: { 'User-Agent': 'PulseFit-Nutrition-Service/1.0' },
      validateStatus: status => status >= 200 && status < 300
    });
    if (!response.data?.product) return null;
    const product = response.data.product;
    const nutrients = product.nutriments || {};
    return {
      foodId,
      name: product.product_name || 'Unknown product',
      brand: product.brands || null,
      nutrientsPer100g: {
        calories: Number(nutrients['energy-kcal_100g'] ?? nutrients.energy_100g ?? 0),
        proteinG: Number(nutrients.proteins_100g ?? 0),
        carbsG: Number(nutrients.carbohydrates_100g ?? 0),
        fatG: Number(nutrients.fat_100g ?? 0)
      }
    };
  } catch (error) {
    console.warn('Open Food Facts product lookup failed:', error.message);
    return null;
  }
}

module.exports = { search, getProduct };

const nutritionApi = require('../services/nutrition-api.client');

function forward(action) {
  return async (req, res, next) => {
    try {
      const result = await action(req);
      res.status(result.status).json(result.data);
    } catch (error) {
      next(error);
    }
  };
}

exports.searchFoods = forward(req => nutritionApi.searchFoods(req.query));

exports.macroBreakdown = forward(req =>
  nutritionApi.macroBreakdown(req.params.foodId, req.query)
);

exports.createLog = forward(req =>
  nutritionApi.createLog(req.body, req.get('authorization'))
);

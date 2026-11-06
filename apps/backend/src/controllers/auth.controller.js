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

exports.login = forward(req => nutritionApi.login(req.body));
exports.refresh = forward(req => nutritionApi.refresh(req.body));

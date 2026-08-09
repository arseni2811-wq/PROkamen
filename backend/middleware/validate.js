const { z } = require("zod");

function validate(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Ошибка валидации",
          errors: result.error.flatten().fieldErrors,
        });
      }
      req.validatedBody = result.data;
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Некорректный формат данных",
      });
    }
  };
}

module.exports = { validate };

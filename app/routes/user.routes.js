const { authJwt } = require("../middlewares");
const controller = require("../controllers/user.controller");
const dataController = require("../controllers/data.controller");
module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.post(
    "/api/test/savemodel",
    [authJwt.verifyToken],
    controller.saveModel
  );

  app.get("/api/test/savedmodels", [authJwt.verifyToken], controller.getAllModels);
  app.get('/api/test/years',[authJwt.verifyToken], dataController.getAllYears);
  app.get('/api/test/contractors', dataController.getAllContractors);
  app.get('/api/test/model-data/:year',[authJwt.verifyToken], dataController.getModelDataByYear);
  app.get('/api/test/contractor-data/:contractor',[authJwt.verifyToken], dataController.getModelDataByContractor);
  app.get("/api/test/all", controller.allAccess);

  app.get("/api/test/user", [authJwt.verifyToken,authJwt.isGeneralUser], controller.userBoard);

  // app.get(
  //   "/api/test/mod",
  //   [authJwt.verifyToken, authJwt.isModerator],
  //   controller.moderatorBoard
  // );

  app.get(
    "/api/test/admin",
    [authJwt.verifyToken, authJwt.isAdmin],
    controller.adminBoard
  );

  app.put('/api/test/editEquipment', [authJwt.verifyToken, authJwt.isAdmin], dataController.editEquipment);
  app.post('/api/test/generate-data', [authJwt.verifyToken, authJwt.isAdmin], dataController.generateNextYearEquipData);
  app.put('/api/test/editfuelcosts', [authJwt.verifyToken, authJwt.isAdmin], dataController.editFuelCosts);
  app.get('/api/test/fuelcosts', [authJwt.verifyToken, authJwt.isAdmin], dataController.getFuelCosts);
  app.get('/api/test/hrlabourwage', [authJwt.verifyToken, authJwt.isAdmin], dataController.getLabourWage);
  app.put('/api/test/edithrlabourwage', [authJwt.verifyToken, authJwt.isAdmin], dataController.updateHourlyWage);
  app.get('/api/test/currentyear', [authJwt.verifyToken], dataController.getCurrentYear);
  app.post('/api/test/addequipment', [authJwt.verifyToken, authJwt.isAdmin], dataController.addNewEquipment);
};

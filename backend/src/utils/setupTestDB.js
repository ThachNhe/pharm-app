const { sequelize } = require('../config/database');

const setupTestDB = () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await sequelize.truncate({ cascade: true, restartIdentity: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });
};

module.exports = setupTestDB;

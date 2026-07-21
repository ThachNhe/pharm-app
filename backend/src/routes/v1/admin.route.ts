import express from 'express';
import auth from '../../middlewares/auth.js';
import requireAdminPanelAccess from '../../middlewares/adminAccess.js';
import validate from '../../middlewares/validate.js';
import * as adminValidation from '../../validations/admin.validation.js';
import * as adminController from '../../controllers/admin.controller.js';

const router = express.Router();

router.use(auth(), requireAdminPanelAccess);

router.get('/me', adminController.getContext);
router.get('/dashboard', adminController.getDashboard);

router
  .route('/stores')
  .get(validate(adminValidation.getStores), adminController.getStores)
  .post(validate(adminValidation.createStore), adminController.createStore);

router.route('/stores/:storeId').patch(validate(adminValidation.updateStore), adminController.updateStore);

router
  .route('/users')
  .get(validate(adminValidation.getUsers), adminController.getUsers)
  .post(validate(adminValidation.createUser), adminController.createUser);

router.route('/users/:userId').patch(validate(adminValidation.updateUser), adminController.updateUser);
router.post('/users/:userId/reset-password', validate(adminValidation.resetPassword), adminController.resetPassword);

router
  .route('/medicines')
  .get(validate(adminValidation.getMedicines), adminController.getMedicines)
  .post(validate(adminValidation.createMedicine), adminController.createMedicine);

router.route('/medicines/:medicineId').patch(validate(adminValidation.updateMedicine), adminController.updateMedicine);

router.get('/import-receipts', validate(adminValidation.getReceipts), adminController.getImportReceipts);
router.get('/sales', validate(adminValidation.getSales), adminController.getSales);
router.get('/reports/profit', validate(adminValidation.getProfitReport), adminController.getProfitReport);

export default router;

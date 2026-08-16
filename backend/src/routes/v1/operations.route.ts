import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as operationsController from '../../controllers/operations.controller.js';
import * as operationsValidation from '../../validations/operations.validation.js';

const router = express.Router();

router.use(auth());

router.get('/context', operationsController.getContext);

router.get('/:storeId/dashboard', validate(operationsValidation.getDashboard), operationsController.getDashboard);

router
  .route('/:storeId/suppliers')
  .get(validate(operationsValidation.getSuppliers), operationsController.getSuppliers)
  .post(validate(operationsValidation.createSupplier), operationsController.createSupplier);

router.patch(
  '/:storeId/suppliers/:supplierId',
  validate(operationsValidation.updateSupplier),
  operationsController.updateSupplier,
);

router
  .route('/:storeId/product-categories')
  .get(validate(operationsValidation.getProductCategories), operationsController.getProductCategories)
  .post(validate(operationsValidation.createProductCategory), operationsController.createProductCategory);

router.patch(
  '/:storeId/product-categories/:categoryId',
  validate(operationsValidation.updateProductCategory),
  operationsController.updateProductCategory,
);

router
  .route('/:storeId/medicines')
  .get(validate(operationsValidation.getMedicines), operationsController.getMedicines)
  .post(validate(operationsValidation.createMedicine), operationsController.createMedicine);

router.patch(
  '/:storeId/medicines/:medicineId',
  validate(operationsValidation.updateMedicine),
  operationsController.updateMedicine,
);

router.get(
  '/:storeId/reference-products',
  validate(operationsValidation.getReferenceProducts),
  operationsController.getReferenceProducts,
);

router
  .route('/:storeId/imports')
  .get(validate(operationsValidation.getImportReceipts), operationsController.getImportReceipts)
  .post(validate(operationsValidation.createImportReceipt), operationsController.createImportReceipt);

router.get(
  '/:storeId/imports/:receiptId',
  validate(operationsValidation.receiptParams),
  operationsController.getImportReceipt,
);
router.post(
  '/:storeId/imports/:receiptId/complete',
  validate(operationsValidation.receiptParams),
  operationsController.completeImportReceipt,
);
router.post(
  '/:storeId/imports/:receiptId/cancel',
  validate(operationsValidation.receiptParams),
  operationsController.cancelImportReceipt,
);

router.get('/:storeId/inventory', validate(operationsValidation.getInventory), operationsController.getInventory);
router.get(
  '/:storeId/inventory/movements',
  validate(operationsValidation.getInventoryMovements),
  operationsController.getInventoryMovements,
);

router
  .route('/:storeId/sales')
  .get(validate(operationsValidation.getSales), operationsController.getSales)
  .post(validate(operationsValidation.createSale), operationsController.createSale);

router.get('/:storeId/sales/:saleId', validate(operationsValidation.saleParams), operationsController.getSale);

router.get('/:storeId/reports/profit', validate(operationsValidation.getProfitReport), operationsController.getProfitReport);

export default router;

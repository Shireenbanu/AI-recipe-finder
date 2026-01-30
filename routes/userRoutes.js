import express from 'express';
import * as userController from '../controllers/UserController.js';

const router = express.Router();

// User management
router.post('/', userController.createUser);
router.get('/:userId', userController.getUserProfile);
router.put('/:userId', userController.updateUserProfile);
router.get('/email/:email', userController.getUserByEmail)
router.get('/lab_reports/:userId', userController.listUserReports)


// Medical conditions
router.get('/:userId/conditions', userController.getUserConditions);
router.post('/:userId/conditions', userController.addMedicalCondition);
router.delete('/:userId/conditions/:conditionId', userController.removeMedicalCondition);
router.get('/:userId/nutritional-needs', userController.getNutritionalNeeds);

export default router;
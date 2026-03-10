const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/users/get-user-data', userController.getUserData);
router.post('/users/change-password', userController.changePassword);
router.post('/users/check-roles', userController.checkRoles);
router.get('/users/info/:username', userController.getUserByUsername);

module.exports = router;
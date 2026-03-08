const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/users/login', userController.login);
router.post('/users/get-user-data', userController.getUserData);
router.post('/users/logout', userController.logout);
router.post('/users/close-all-sessions', userController.closeAllSessions);
router.post('/users/close-other-sessions', userController.closeOtherSessions);
router.post('/users/check-active-session', userController.checkActiveSession);
router.post('/users/get-sessions', userController.getSessions);
router.post('/users/change-password', userController.changePassword);
router.post('/users/check-roles', userController.checkRoles);
router.get('/profile/:username', userController.getUserByUsername);

module.exports = router;
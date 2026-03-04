const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/users/login', userController.login);
router.post('/users/getUserData', userController.getUserData);
router.post('/users/logout', userController.logout);
router.post('/users/closeAllSessions', userController.closeAllSessions);
router.post('/users/closeOtherSessions', userController.closeOtherSessions);
router.post('/users/checkActiveSession', userController.checkActiveSession);
router.post('/users/getSessions', userController.getSessions);
router.post('/users/changePassword', userController.changePassword);
router.post('/users/checkRoles', userController.checkRoles);
router.get('/profile/:username', userController.getUserByUsername);

module.exports = router;
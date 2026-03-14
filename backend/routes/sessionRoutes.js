const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

router.post('/sessions/login', sessionController.login);
router.post('/sessions/logout', sessionController.logout);
router.post('/sessions/close-all', sessionController.closeAll);
router.post('/sessions/close-other', sessionController.closeOther);
router.post('/sessions/check-active', sessionController.checkActive);
router.post('/sessions/get', sessionController.get);

module.exports = router;
const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

router.post('/sessions/login', sessionController.login);
router.post('/sessions/logout', sessionController.logout);
router.post('/sessions/close-all-sessions', sessionController.closeAllSessions);
router.post('/sessions/close-other-sessions', sessionController.closeOtherSessions);
router.post('/sessions/check-active-session', sessionController.checkActiveSession);
router.post('/sessions/get-sessions', sessionController.getSessions);

module.exports = router;
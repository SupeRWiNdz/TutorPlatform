const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');

router.post('/requests/create', requestController.create);
router.post('/requests/check', requestController.check);
router.post('/requests/accept', requestController.accept);
router.post('/requests/decline', requestController.decline);
router.post('/requests/users-to-invite', requestController.getUsersToInvite);

module.exports = router;
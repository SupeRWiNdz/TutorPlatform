const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');

router.post('/requests/user', requestController.createForUser);
router.post('/requests/everyone', requestController.createForEveryone);
router.post('/requests/check', requestController.check);
router.post('/requests/accept', requestController.accept);
router.post('/requests/decline', requestController.decline);

module.exports = router;
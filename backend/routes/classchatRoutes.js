const express = require('express');
const router = express.Router();
const classchatController = require('../controllers/classchatController');

router.post('/classchat/send', classchatController.sendMessage);
router.post('/classchat/get', classchatController.getMessages);
router.post('/classchat/get-new', classchatController.getNewMessages);

module.exports = router;
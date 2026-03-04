const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

router.post('/messages/send', messageController.sendMessage);
router.post('/messages/get', messageController.getMessages);

module.exports = router;
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

router.post('/messages/send', messageController.sendMessage);
router.post('/messages/get', messageController.getMessages);
router.post('/messages/chats', messageController.getChats);
router.post('/messages/get-after', messageController.getMessagesAfter);

module.exports = router;
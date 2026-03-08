const express = require('express');
const router = express.Router();
const messageController = require('../controllers/classController');

router.post('/class/new', messageController.createClass);
router.post('/class/delete', messageController.deleteClass);
router.post('/class/edit', messageController.editClass);
router.post('/class/info', messageController.getClass);
router.post('/class/list', messageController.myClasses);
router.post('/class/invite', messageController.addMember);
router.post('/class/delete-member', messageController.deleteMember);
router.post('/class/leave', messageController.leave);
router.post('/class/edit-role', messageController.editRole);

module.exports = router;
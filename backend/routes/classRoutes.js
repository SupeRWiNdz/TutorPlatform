const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');

router.post('/class/new', classController.createClass);
router.post('/class/delete', classController.deleteClass);
router.post('/class/edit', classController.editClass);
router.post('/class/info/:link', classController.getClass);
router.post('/class/list', classController.myClasses);
router.post('/class/invite', classController.addMember);
router.post('/class/delete-member', classController.deleteMember);
router.post('/class/leave', classController.leave);
router.post('/class/edit-role', classController.editRole);

module.exports = router;
const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lessonController');

router.post('/lessons/create', lessonController.create);
router.post('/lessons/get', lessonController.get);
router.post('/lessons/get-personal', lessonController.getPersonal);
router.post('/lessons/get-near', lessonController.getNearest);
router.post('/lessons/remove', lessonController.remove);
router.post('/lessons/edit', lessonController.edit);

module.exports = router;
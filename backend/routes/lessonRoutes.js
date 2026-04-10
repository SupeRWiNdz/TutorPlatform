const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lessonController');

router.post('/lessons/create-class-lesson', lessonController.createClassLesson);
router.post('/lessons/get', lessonController.getLessons);

module.exports = router;
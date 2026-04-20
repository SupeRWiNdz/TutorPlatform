const express = require('express');
const router = express.Router();
const advertisementsController = require('../controllers/advertisementsController');

router.post('/advertisements/create', advertisementsController.create);
router.post('/advertisements/edit', advertisementsController.edit);
router.post('/advertisements/remove', advertisementsController.remove);
router.post('/advertisements/archive', advertisementsController.archive);
router.post('/advertisements/get', advertisementsController.get);
router.post('/advertisements/get-my', advertisementsController.getMy);

module.exports = router;
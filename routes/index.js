var express = require('express');
var router = express.Router();
const leadsRouter = require('./leads');
/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});


router.use('/lead', leadsRouter);
module.exports = router;
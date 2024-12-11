var express = require('express');
var router = express.Router();
const leadsRouter = require('./leads');
const usersRouter = require('./users');
const dashBoardRouter = require('./userDashboard')
    // const userDetailsRouter = require('./userDetails');
    /* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});
router.use('/user', usersRouter);
//router.use('/creator', usersRouter);
router.use('/leads ', leadsRouter);
router.use('/', dashBoardRouter);
module.exports = router;
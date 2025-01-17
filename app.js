var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session')

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var leadRouter = require('./routes/leads')
var credentialRouter=require('./routes/credentails')
var userDashboardRouter = require('./routes/userDashboard')
var requrestCredentialRouter=require('./routes/requestCredential')

var app = express();
app.use(session({
    secret: '123456', // Replace with a strong secret key
     resave: false,
    saveUninitialized: true,
    secure: false,
    cookie: {
      maxAge: 1000 * 60 * 60, 
      secure: false,  // 1 hour in milliseconds (1000 ms * 60 s * 60 m)
    }
  
}));

//logouting user
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error logging out:', err);
        res.status(500).send('Error logging out');
      } else {
        res.redirect('users/login'); 
      }
    });
  });

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());


app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/leads', leadRouter)
app.use('/user', userDashboardRouter)
app.use('/credential',credentialRouter)
app.use('/request',requrestCredentialRouter)


// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const pool = require('../database/connection'); // Assuming connection.js handles your pool
const router = express.Router();

// GET route to render requestCredential.ejs page
// GET route to render requestCredential.ejs page
router.get('/request-credential', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized');
  }
  const isCurrentUser=req.session.user.id;
  console.log(isCurrentUser)
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting connection:', err);
        return res.status(500).send('Server Error');
      }
  
      connection.query('SELECT client_credential_id, client_credential_name, client_credential_email, client_credential_password, client_credential_type FROM client_credentials', (err, clients) => {
        connection.release(); // Release connection back to the pool
  
        if (err) {
          console.error('Error executing query:', err);
          return res.status(500).send('Server Error');
        }
  
        // Render the requestCredential page and send client details
        res.render('requestCredential', { clients,isCurrentUser });
      });
    });
  });
  
// POST route to send OTP
router.post('/send-otp', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized');
  }
    const client_id = req.body.client_name;
    const isCurrentUser=req.session.user.id;
  
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting connection:', err);
        return res.status(500).send('Server Error');
      }
  
      // Fetch client details from the database
      connection.query('SELECT * FROM client_credentials WHERE client_credential_id = ?', [client_id], (err, rows) => {
        if (err) {
          console.error('Error executing query:', err);
          connection.release();
          return res.status(500).send('Server Error');
        }
  
        if (rows.length === 0) {
          connection.release();
          return res.status(404).send('Client not found');
        }
  
        const client = rows[0];
  
        // Generate a random OTP
        const otp = crypto.randomBytes(3).toString('hex');  // 6-character OTP (3 bytes = 6 chars in hex)
  
        // Set OTP expiry time (5 minutes)
        const otpExpireTime = Date.now() + 5 * 60 * 1000;  // 5 minutes from now
  
        // Store OTP and expiry time in the session
        req.session.otp = otp;
        req.session.otpExpireTime = otpExpireTime;
        req.session.clientCredentialId = client.client_credential_id;
  
        // Send OTP via email using Nodemailer
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'anuragpokhriyal174@gmail.com', // Company email
            pass: 'lteg spzm fjjn qkvt',         // App-specific password
          },
          tls: {
            rejectUnauthorized: false // Allow self-signed certificates
          }
        });
  
        const mailOptions = {
          from: 'anuragpokhriyal174@gmail.com',
          to: 'anuragpokhriyal174@gmail.com', // Send OTP to client email
          subject: 'Your OTP Code',
          text: `Your OTP code is: ${otp}`
        };
  
        transporter.sendMail(mailOptions, (error, info) => {
          connection.release(); // Release connection back to the pool after sending OTP
  
          if (error) {
            console.log(error);
            return res.status(500).send('Error sending OTP.');
          }
          console.log('OTP sent: ' + info.response);
          res.render('verifyOtp' ,{isCurrentUser});  // Redirect to OTP input page
        });
      });
    });
  });

  // POST route to verify OTP
router.post('/verify-otp', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized');
  }  const isCurrentUser=req.session.user.id;
    const userOtp = req.body.otp;
    const sessionOtp = req.session.otp;
    const otpExpireTime = req.session.otpExpireTime;
  
    // Check if OTP is expired
    if (Date.now() > otpExpireTime) {
      return res.status(400).send('OTP expired. Please request a new one.');
    }
  
    // Check if OTP matches
    if (userOtp !== sessionOtp) {
      return res.status(400).send('Invalid OTP.');
    }
  
    // Fetch client credentials from the database
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting connection:', err);
        return res.status(500).send('Server Error');
      }
  
      connection.query('SELECT * FROM client_credentials WHERE client_credential_id = ?', [req.session.clientCredentialId], (err, rows) => {
        connection.release(); // Release connection back to the pool
  
        if (err) {
          console.error('Error executing query:', err);
          return res.status(500).send('Server Error');
        }
  
        if (rows.length === 0) {
          return res.status(404).send('Client credentials not found.');
        }
  
        const client = rows[0];
  
        // Render the credentials page with client details
        res.render('client_credentials', {
          client_credential_email: client.client_credential_email,
          client_credential_password: client.client_credential_password,
          client_credential_type: client.client_credential_type,isCurrentUser
        });
      });
    });
  });
  
  
router.get('/otp-sent', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized');
  }
  const isCurrentUser=req.session.user.id;
    res.render('otpSent', { otpSent: true ,isCurrentUser});
  });


// POST route to send OTP

module.exports = router;

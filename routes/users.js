const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../database/connection');

router.get('/register', (req, res) => {
    res.render('userRegistration');
});

// registering users
router.post('/register', (req, res) => {
    var firstName = req.body.firstName;
    var lastName = req.body.lastName;
    var email = req.body.email;
    var role = req.body.role;
    var password = req.body.password;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            res.status(500).send('Error connecting to database');
            return;
        }

        // Check if email already exists
        connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
            if (err) {
                console.error('Error checking for existing email:', err);
                res.status(500).send('Error checking for existing email');
                return;
            }

            if (results.length > 0) {
                return res.status(400).send('Email already exists');
            }

            // Hash the password
            bcrypt.hash(password, 10, (err, hash) => {
                if (err) {
                    console.error('Error hashing password:', err);
                    res.status(500).send('Error hashing password');
                    return;
                }

                // Insert user with hashed password
                var sql = "INSERT INTO users(first_name, last_name, email, role, password_hash) VALUES(?,?,?,?,?)";
                connection.query(sql, [firstName, lastName, email, role, hash], (error, results) => {
                    connection.release(); // Release the connection back to the pool

                    if (error) {
                        console.error('Error inserting data:', error);
                        res.status(500).send('Error inserting data');
                        return;
                    }

                    console.log('Data inserted successfully');
                    res.redirect('/users/login');
                });
            });
        });
    });
});

router.get('/login', (req, res) => {
    res.render('login');
});



router.post('/login', (req, res) => {
    const { email, password } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            res.status(500).send('Error connecting to database');
            return;
        }

        connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
            if (err) {
                console.error('Error fetching user:', err);
                res.status(500).send('Error fetching user');
                connection.release();
                return;
            }

            if (results.length === 0) {
                connection.release();
                return res.status(401).send('Invalid email or password');
            }

            const user = results[0];

            bcrypt.compare(password, user.password_hash, (err, isMatch) => {
                if (err) {
                    console.error('Error comparing passwords:', err);
                    res.status(500).send('Error comparing passwords');
                }

                if (isMatch) {
                    connection.release();

                    res.render('dashboard')
                } else {
                    connection.release();
                    res.status(401).send('Invalid email or password');
                }
            });
        });
    });
});

module.exports = router;
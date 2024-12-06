const express = require('express');
const router = express.Router();
const pool = require('../database/connection');

router.get('/create', (req, res) => {
    res.render('leadForm');
});

router.post('/create', (req, res) => {
    var firstName = req.body.firstName;
    var lastName = req.body.lastName;
    var email = req.body.email;
    var phone = req.body.phoneNumber;
    var company = req.body.companyName;
    var leadScore = req.body.leadScore;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            res.status(500).send('Error connecting to database');
            return;
        }

        var sql = "INSERT INTO leads(first_name, last_name, email, phone_number, company_name, lead_score,created_at,updated_at) VALUES(?,?,?,?,?,?,NOW(),NOW())";
        connection.query(sql, [firstName, lastName, email, phone, company, leadScore], (error, results) => {
            connection.release(); // Release the connection back to the pool

            if (error) {
                console.error('Error inserting data:', error);
                res.status(500).send('Error inserting data');
                return;
            }

            console.log('Data inserted successfully');

            // Fetch all leads after successful insertion
            connection.query('SELECT * FROM leads', (error, results) => {
                if (error) {
                    console.error('Error retrieving data:', error);
                    res.status(500).send('Error retrieving data');
                    return;
                }

                res.render('leadMainPage', { leads: results });
            });

        });
    });
});

router.get('/', (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            res.status(500).send('Error connecting to database');
            return;
        }
        var sql = "SELECT * FROM leads"
        connection.query(sql, (error, results) => {
            connection.release();

            if (error) {
                console.error('Error retrieving data:', error);
                res.status(500).send('Error retrieving data');
                return;
            }

            res.render('leadMainPage', { leads: results });
        });
    });
});

module.exports = router;
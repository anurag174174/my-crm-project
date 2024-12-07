const express = require('express');
const router = express.Router();

const pool = require('../database/connection');

router.get('/create', (req, res) => {
    res.render('leadForm');
});

router.post('/create', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized');
    }

    var firstName = req.body.firstName;
    var lastName = req.body.lastName;
    var email = req.body.email;
    var phone = req.body.phoneNumber;
    var company = req.body.companyName;
    var leadScore = req.body.leadScore;
    const userId = req.session.user.id;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            res.status(500).send('Error connecting to database');
            return;
        }

        var sql = "INSERT INTO leads(first_name, last_name, email, phone_number, company_name, lead_score,lead_owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,NOW(),NOW())";
        connection.query(sql, [firstName, lastName, email, phone, company, leadScore, userId], (error, results) => {
            connection.release();

            if (err) {
                console.error('Error inserting data:', error);
                res.status(500).send('Error inserting data');
                return;
            }

            console.log('Data inserted successfully');

            // Redirect to leads list page after successful insertion
            res.redirect('/leads');
        });
    });
});

router.get('/', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized');
    }

    const userId = req.session.user.id;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            res.status(500).send('Error connecting to database');
            return;
        }

        var sql = "SELECT * FROM leads WHERE lead_owner_id = ?";
        connection.query(sql, [userId], (error, results) => {
            connection.release();

            if (err) {
                console.error('Error retrieving data:', error);
                res.status(500).send('Error retrieving data');
                return;
            }

            res.render('leadMainPage', { leads: results });
        });
    });
});

module.exports = router; // const express = require('express');
// const router = express.Router();

// const pool = require('../database/connection');

// router.get('/create', (req, res) => {
//     res.render('leadForm');
// });

// router.post('/create', (req, res) => {
//     if (!req.session.user) {
//         return res.status(401).send('unauthorized')
//     }

//     var firstName = req.body.firstName;
//     var lastName = req.body.lastName;
//     var email = req.body.email;
//     var phone = req.body.phoneNumber;
//     var company = req.body.companyName;
//     var leadScore = req.body.leadScore;
//     const userId = req.session.user.id;

//     pool.getConnection((err, connection) => {
//         if (err) {
//             console.error('Error getting connection from pool:', err);
//             res.status(500).send('Error connecting to database');
//             return;
//         }

//         var sql = "INSERT INTO leads(first_name, last_name, email, phone_number, company_name, lead_score,lead_owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,NOW(),NOW())";
//         connection.query(sql, [firstName, lastName, email, phone, company, leadScore, userId], (error, results) => {
//             connection.release(); // Release the connection back to the pool

//             if (error) {
//                 console.error('Error inserting data:', error);
//                 res.status(500).send('Error inserting data');
//                 return;
//             }

//             console.log('Data inserted successfully');

//             // Fetch all leads after successful insertion
//             connection.query('SELECT * FROM leads', (error, results) => {
//                 if (error) {
//                     console.error('Error retrieving data:', error);
//                     res.status(500).send('Error retrieving data');
//                     return;
//                 }

//                 res.render('leadMainPage', { leads: results });
//             });

//         });
//     });
// });

// router.get('/', (req, res) => {

//     if (!req.session.user) {
//         return res.status(401).send('unauthorized');
//     }


//     pool.getConnection((err, connection) => {
//         if (err) {
//             console.error('Error getting connection from pool:', err);
//             res.status(500).send('Error connecting to database');
//             return;
//         }
//         var sql = "SELECT * FROM leads where lead_owner_id =?"
//         connection.query(sql, [userId], (error, results) => {
//             connection.release();

//             if (error) {
//                 console.error('Error retrieving data:', error);
//                 res.status(500).send('Error retrieving data');
//                 return;
//             }

//             res.render('leadMainPage', { leads: results });
//         });
//     });
// });

// module.exports = router;
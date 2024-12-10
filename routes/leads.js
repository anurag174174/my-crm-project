const express = require('express');
const router = express.Router();

const pool = require('../database/connection');

router.get('/create', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized');
    }

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

        var sql = "INSERT INTO leads(first_name, last_name, email, phone_number, company_name, lead_score,lead_owner_id,created_at,updated_at) VALUES(?,? OR NULL,?,? OR NULL,? OR NULL,? OR NULL,?,NOW(),NOW())";
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

//viewing leads
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

        // First query: Get leads for the current user
        connection.query(`
        SELECT 
            l.*, 
            u.first_name as ownerFirstName, 
            u.last_name as ownerLastName 
        FROM 
            leads l 
        LEFT JOIN 
            users u ON l.lead_owner_id = u.user_id 
        WHERE 
            l.lead_owner_id = ? 
        ORDER BY 
            l.created_at DESC`, [userId], (err, leadsResults) => {
            if (err) {
                console.error('Error retrieving leads:', err);
                res.status(500).send('Error retrieving leads');
                return;
            }

            // Second query: Get all users
            connection.query('SELECT user_id, CONCAT(first_name, " ", last_name) as full_name FROM users', (err, usersResults) => {
                if (err) {
                    console.error('Error retrieving users:', err);
                    res.status(500).send('Error retrieving users');
                    return;
                }

                // Check if leads were found
                if (Array.isArray(leadsResults) && leadsResults.length > 0) {
                    res.render('leadMainPage', { leads: leadsResults, users: usersResults });
                } else {
                    console.error('No leads found.');
                    res.status(404).send('No leads found.');
                }

                connection.release();
            });
        });
    });
});
router.post('/:leadId/assign', (req, res) => {
    const leadId = req.params.leadId;
    const selectedUserId = req.body.selectedUserId;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            res.status(500).send('Error connecting to database: ' + err.message);
            return;
        }

        // Update the lead owner_id directly using the provided selectedUserId
        const updateQuery = 'UPDATE leads SET lead_owner_id = ? WHERE lead_id = ?';
        connection.query(updateQuery, [selectedUserId, leadId], (err, results) => {
            connection.release();

            if (err) {
                console.error('Error updating lead owner:', err);
                res.status(500).send('Error updating lead owner: ' + err.message);
                return;
            }

            if (results.affectedRows === 0) {
                console.error('No rows were affected by the UPDATE query.');
                res.status(404).send('Lead not found or update failed.');
                return;
            }

            res.json({ message: 'Lead owner updated successfully' });
        });
    });
});

//lead udpate 

router.get('/:leadId/edit', (req, res) => {
    const leadId = req.params.leadId;
    console.log("Received leadId:", leadId);

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            res.status(500).send('Error connecting to database');
            return;
        }

        connection.query('SELECT * FROM leads WHERE lead_id = ?', [leadId], (error, results) => {
            connection.release();

            if (error) {
                console.error('Error fetching lead:', error);
                res.status(500).send('Error fetching lead data');
                return;
            }

            if (results.length === 0) {
                return res.status(404).send('Lead not found');
            }
            console.log(results)

            res.render('editLead', { lead: results[0] });
        });
    });
});


// lead update

router.post('/:leadId/edit', (req, res) => {
    const leadId = req.params.leadId;
    const { firstName, lastName, email, phone, company ,leadScore } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            res.status(500).send('Error connecting to database');
            return;
        }

        connection.query('UPDATE leads SET first_name = ?, last_name = ?, email = ?, phone_number = ?, company_name = ? , lead_score= ? WHERE lead_id = ?', [firstName, lastName, email, phone, company, leadScore,leadId],
            (error, results) => {
                connection.release();

                if (error) {
                    console.error('Error updating lead:', error);
                    res.status(500).send('Error updating lead data');
                    return;
                }

                if (results.affectedRows === 0) {
                    return res.status(404).send('Lead not found');
                }

                res.redirect('/leads'); // Redirect to the leads main page after successful update
            });
    });
});

module.exports = router;


// router.post('/:leadId/assign', (req, res) => {
//     const leadId = req.params.leadId;
//     const { lead_owner_id } = req.body;

//     pool.getConnection((err, connection) => {
//         if (err) {
//             console.error('Error getting connection from pool:', err);
//             res.status(500).send('Error connecting to database');
//             return;
//         }

//         const updateQuery = 'UPDATE leads SET lead_owner_id = ? WHERE user_id = ?';
//         connection.query(updateQuery, [lead_owner_id, leadId], (error, results) => {
//             connection.release();

//             if (error) {
//                 console.error('Error updating lead owner:', error);
//                 res.status(500).send('Error updating lead owner');
//                 return;
//             }

//             if (results.affectedRows === 0) {
//                 return res.status(404).send('Lead not found');
//             }

//             res.json({ message: 'Lead owner updated successfully' });
//         });
//     });
// });

// const express = require('express');
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
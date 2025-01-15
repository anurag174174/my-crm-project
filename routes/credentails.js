const express = require('express');
const router = express.Router();
const pool = require('../database/connection'); // Adjust the path to your database connection file

router.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.render('unauthorized');
      }
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection:', err);
            return res.status(500).send('Server error');
        }

        const query = `
            SELECT 
               *
            FROM client_credentials
        `;

        connection.query(query, (err, results) => {
            connection.release(); // Release the connection back to the pool

            if (err) {
                console.error('Error executing query:', err);
                return res.status(500).send('Server error');
            }

            // Render the EJS template with the fetched data
            res.render('adminViewCredentials', { clientCredentials: results });
        });
    });
});


// GET route to display the form
router.get('/addcredential', (req, res) => {
    if (!req.session.user) {
        return res.render('unauthorized');
      }
    const user_id = req.session.user.id;
    console.log(user_id) 
    res.render('addCredential'); // Ensure the EJS template is correctly named
});

// POST route to handle form submission
router.post('/addcredential', (req, res) => {
    if (!req.session.user) {
        return res.render('unauthorized');
    }

    // Assuming req.user contains the logged-in user information (set by middleware during login)
    const { client_credential_email, client_credential_password, client_credential_type, client_credential_name } = req.body;
    const user_id = req.session.user.id;
    console.log(user_id) // Get user_id from the logged-in user

    // if (!user_id) {
    //     return res.status(401).send('Unauthorized: No logged-in user');
    // }

    // SQL query to insert into the database
    const insertQuery = `
        INSERT INTO client_credentials 
        (client_credential_email, client_credential_password, client_credential_type, client_credential_name, user_id) 
        VALUES (?, ?, ?, ?, ?)
    `;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error connecting to the database:', err);
            res.status(500).send('Database connection error');
            return;
        }

        // Execute the query
        connection.query(
            insertQuery,
            [client_credential_email, client_credential_password, client_credential_type, client_credential_name, user_id],
            (err, results) => {
                connection.release(); // Release the connection back to the pool

                if (err) {
                    console.error('Error executing query:', err);
                    res.status(500).send('Error saving the client credential');
                } else {
                    console.log('Client credential added:', results);
                    res.redirect('/credential'); // Redirect to home or any desired page after successful insertion
                }
            }
        );
    });
});



router.get('/update-credential', (req, res) => {
    if (!req.session.user) {
        return res.render('unauthorized');
    }
    
    const { client_credential_id } = req.query;
    console.log(client_credential_id);

    // SQL query to fetch the client credentials by ID, including the new fields (name, type)
    const selectQuery = `SELECT client_credential_id, client_credential_email, client_credential_password, 
                         client_credential_name, client_credential_type 
                         FROM client_credentials WHERE client_credential_id = ?`;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error connecting to the database:', err);
            res.status(500).send('Database connection error');
            return;
        }

        // Fetch the existing client credential data
        connection.query(selectQuery, [client_credential_id], (err, results) => {
            connection.release();

            if (err) {
                console.error('Error fetching client credential:', err);
                res.status(500).send('Error fetching client credential');
                return;
            }

            if (results.length === 0) {
                res.status(404).send('Credential not found');
                return;
            }

            const clientCredential = results[0];

            // Render the update form with the entire clientCredential object
            res.render('updateCredential', { clientCredential });
        });
    });
});



// POST route for updating credentials
router.post('/update-credential', (req, res) => {
    if (!req.session.user) {
        return res.render('unauthorized');
    }

    // Extracting required fields from the request body
    const { client_credential_id, client_credential_email, client_credential_password, client_credential_name, client_credential_type } = req.body;

    // SQL query to fetch the current password of the client credential
    const selectQuery = `SELECT client_credential_password FROM client_credentials WHERE client_credential_id = ?`;

    // SQL query to update the credentials
    const updateQuery = `
        UPDATE client_credentials 
        SET 
            client_credential_email = ?, 
            client_credential_name = ?, 
            client_credential_previous_password = ?, 
            client_credential_password = ?, 
            client_credential_type = ? 
        WHERE client_credential_id = ?
    `;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error connecting to the database:', err);
            res.status(500).send('Database connection error');
            return;
        }

        // Fetch the current password first
        connection.query(selectQuery, [client_credential_id], (err, results) => {
            if (err) {
                connection.release();
                console.error('Error fetching current password:', err);
                res.status(500).send('Error fetching current password');
                return;
            }

            if (results.length === 0) {
                connection.release();
                res.status(404).send('Credential not found');
                return;
            }

            const currentPassword = results[0].client_credential_password;

            // Update the credentials, including name and type
            connection.query(
                updateQuery,
                [
                    client_credential_email, 
                    client_credential_name,  // New name field
                    currentPassword,  // Previous password
                    client_credential_password,  // New password
                    client_credential_type,  // New type
                    client_credential_id
                ],
                (err, results) => {
                    connection.release();

                    if (err) {
                        console.error('Error updating credential:', err);
                        res.status(500).send('Error updating credential');
                    } else {
                        console.log('Credential updated successfully:', results);
                        res.redirect('/credential'); // Redirect after successful update
                    }
                }
            );
        });
    });
});


module.exports = router;

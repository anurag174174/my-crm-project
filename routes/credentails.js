const express = require('express');
const router = express.Router();
const pool = require('../database/connection'); // Adjust the path to your database connection file

// GET route to display client credentials
router.get('/', (req, res) => {
    try {
        if (!req.session.user) {
            return res.render('unauthorized');
        }
        const currentUser=req.session.user.id;
        pool.getConnection((err, connection) => {
            if (err) {
                console.error('Error getting connection:', err);

                const errorMessage = 'Server Error.';
                return res.render('error', { errorMessage })
                
            }

            const query = `SELECT * FROM client_credentials`;

            connection.query(query, (err, results) => {
                connection.release(); // Release the connection back to the pool

                if (err) {
                    console.error('Error executing query:', err);
                    const errorMessage = 'Server Error.';
                    return res.render('error', { errorMessage })
                }

                // Render the EJS template with the fetched data
                res.render('adminViewCredentials', { clientCredentials: results ,currentUser});
            });
        });
    } catch (err) {
        console.error('Unexpected error:', err);
        const errorMessage = 'Server Error.';
        return res.render('error', { errorMessage })
    }
});

// GET route to display the form for adding a new credential
router.get('/addcredential', (req, res) => {
    try {
        if (!req.session.user) {
            return res.render('unauthorized');
        }

        const currentUser=req.session.user.id;
        

        res.render('addCredential' ,{currentUser}); // Ensure the EJS template is correctly named
    } catch (err) {
        
        const errorMessage = 'Unexpected error';
        return res.render('error', { errorMessage })
    }
});

// POST route to handle form submission for adding a new credential
router.post('/addcredential', (req, res) => {
    try {
        if (!req.session.user) {
            return res.render('unauthorized');
        }

        // Assuming req.user contains the logged-in user information (set by middleware during login)
        const { client_credential_email, client_credential_password, client_credential_type, client_credential_name, client_credential_other } = req.body;
        const user_id = req.session.user.id;

        // Check if "Other" was selected for credential type, and set the appropriate type
        const credentialType = (client_credential_type === 'Other') ? client_credential_other : client_credential_type;

        // SQL query to insert into the database
        const insertQuery = `
            INSERT INTO client_credentials 
            (client_credential_email, client_credential_password, client_credential_type, client_credential_name, user_id) 
            VALUES (?, ?, ?, ?, ?)
        `;

        pool.getConnection((err, connection) => {
            if (err) {
                console.error('Error connecting to the database:', err);

                const errorMessage = 'Database connection error';
                return res.render('error', { errorMessage })
                

                
            }

            // Execute the query
            connection.query(
                insertQuery,
                [client_credential_email, client_credential_password, credentialType, client_credential_name, user_id],
                (err, results) => {
                    connection.release(); // Release the connection back to the pool

                    if (err) {
                        console.error('Error executing query:', err);

                        const errorMessage = 'Error saving the client credential you might enter same email';
                return res.render('error', { errorMessage })
                        
                    } else {
                        console.log('Client credential added:', results);
                        res.redirect('/credential'); // Redirect to home or any desired page after successful insertion
                    }
                }
            );
        });
    } catch (err) {
        console.error('Unexpected error:', err);

        const errorMessage = 'Unexpected error';
        return res.render('error', { errorMessage })
        
    }
});

// GET route to update the client credential
router.get('/update-credential', (req, res) => {
    try {
        if (!req.session.user) {
            return res.render('unauthorized');
        }

        const { client_credential_id } = req.query;
        console.log(client_credential_id);
        const currentUser=req.session.user.id;
        // SQL query to fetch the client credentials by ID, including the new fields (name, type)
        const selectQuery = `SELECT client_credential_id, client_credential_email, client_credential_password, 
                             client_credential_name
                             FROM client_credentials WHERE client_credential_id = ?`;

        pool.getConnection((err, connection) => {
            if (err) {
                console.error('Error connecting to the database:', err);

                const errorMessage = 'Database connection error';
        return res.render('error', { errorMessage })
                
            }

            // Fetch the existing client credential data
            connection.query(selectQuery, [client_credential_id], (err, results) => {
                connection.release();

                if (err) {
                    console.error('Error fetching client credential:', err);

                    const errorMessage = 'Error fetching client credential';
        return res.render('error', { errorMessage })
                   
                }

                if (results.length === 0) {

                    const errorMessage = 'Credential not found';
                     return res.render('error', { errorMessage })
                   
                }

                const clientCredential = results[0];

                // Render the update form with the entire clientCredential object
                res.render('updateCredential', { clientCredential,currentUser });
            });
        });
    } catch (err) {
        console.error('Unexpected error:', err);
        const errorMessage = 'Unexpected error';
        return res.render('error', { errorMessage })
    }
});

// POST route for updating client credentials
router.post('/update-credential', (req, res) => {
    try {
        if (!req.session.user) {
            return res.render('unauthorized');
        }

        // Extracting required fields from the request body
        const { client_credential_id, client_credential_email, client_credential_password, client_credential_name } = req.body;

        // SQL query to fetch the current password of the client credential
        const selectQuery = `SELECT client_credential_password FROM client_credentials WHERE client_credential_id = ?`;

        // SQL query to update the credentials (excluding client_credential_type)
        const updateQuery = `
            UPDATE client_credentials 
            SET 
                client_credential_email = ?, 
                client_credential_name = ?, 
                client_credential_previous_password = ?, 
                client_credential_password = ? 
            WHERE client_credential_id = ?
        `;

        pool.getConnection((err, connection) => {
            if (err) {
                console.error('Error connecting to the database:', err);

                const errorMessage = 'Database connection error';
                return res.render('error', { errorMessage })
                
                
            }

            // Fetch the current password first
            connection.query(selectQuery, [client_credential_id], (err, results) => {
                if (err) {
                    connection.release();
                    console.error('Error fetching current password:', err);

                    const errorMessage = 'Error fetching current password';
                    return res.render('error', { errorMessage })
                   
                }

                if (results.length === 0) {
                    connection.release();

                    const errorMessage = 'Credential not found';
                    return res.render('error', { errorMessage })
                  
                }

                const currentPassword = results[0].client_credential_password;

                // Update the credentials, including name and password, but not type
                connection.query(
                    updateQuery,
                    [
                        client_credential_email, 
                        client_credential_name,  // New name field
                        currentPassword,  // Previous password
                        client_credential_password,  // New password
                        client_credential_id
                    ],
                    (err, results) => {
                        connection.release();

                        if (err) {
                            console.error('Error updating credential:', err);

                            const errorMessage = 'Error updating credential';
                            return res.render('error', { errorMessage })
                           
                        } else {
                            console.log('Credential updated successfully:', results);
                            res.redirect('/credential'); // Redirect after successful update
                        }
                    }
                );
            });
        });
    } catch (err) {
        console.error('Unexpected error:', err);
        const errorMessage = 'Unexpected error';
        return res.render('error', { errorMessage })
    }
});

module.exports = router;

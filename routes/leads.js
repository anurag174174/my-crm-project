const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

const pool = require('../database/connection');

// Middleware to check if the user has the correct role
function checkUserRole(req, res, next) {
  if (!req.session.user) {
    return res.render('unauthorized'); // User is not logged in
  }

  const userId = req.session.user.id; // Assuming the user's ID is stored in the session
  const query = 'SELECT user_role_id, is_admin FROM users WHERE user_id = ?';

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting database connection:', err);
      return res.status(500).send('Internal Server Error');
    }

    connection.query(query, [userId], (err, results) => {
      connection.release(); // Always release the connection back to the pool

      if (err) {
        console.error('Error querying database:', err);
        return res.status(500).send('Internal Server Error');
      }

      if (results.length === 0) {
        return res.status(404).send('User not found');
      }

      const userRoleId = results[0].user_role_id;
      const isAdmin = results[0].is_admin;

      // Check if the user is either role 2 (authorized user) or admin
      if (userRoleId !== 2 && isAdmin !== 1) {
        return res.status(403).send('Forbidden: You do not have access to this resource');
      }

      next(); // User has the correct role, proceed to the next middleware or route handler
    });
  });
}

// GET /create route with role check
router.get('/create', checkUserRole, (req, res) => {
  const userId = req.session.user.id; // Get the logged-in user's ID

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      return res.status(500).send('Error connecting to database');
    }

    // Fetch lead statuses
    connection.query('SELECT * FROM lead_statuses', (err, statuses) => {
      if (err) {
        console.error('Error fetching lead statuses:', err);
        connection.release();
        return res.status(500).send('Error fetching lead statuses');
      }

      // Fetch lead sources
      connection.query('SELECT * FROM lead_sources', (err, leadSources) => {
        if (err) {
          console.error('Error fetching lead sources:', err);
          connection.release();
          return res.status(500).send('Error fetching lead sources');
        }

        // Fetch lead categories
        connection.query('SELECT * FROM lead_categories', (err, leadCategories) => {
          if (err) {
            console.error('Error fetching lead categories:', err);
            connection.release();
            return res.status(500).send('Error fetching lead categories');
          }

          // Fetch the logged-in user's owner details
          connection.query('SELECT user_id, first_name, last_name FROM users WHERE user_id = ?', [userId], (err, ownerDetails) => {
            if (err) {
              console.error('Error fetching owner details:', err);
              connection.release();
              return res.status(500).send('Error fetching owner details');
            }

            if (ownerDetails.length === 0) {
              connection.release();
              return res.status(404).send('User not found');
            }

            // Get owner details
            const user = ownerDetails[0];

            // Release the connection and render the lead creation form
            connection.release();
            res.render('leadForm', { statuses, leadSources, leadCategories, user });
          });
        });
      });
    });
  });
});

// POST /create route with role check
router.post('/create', checkUserRole, (req, res) => {
  const { 
    firstName, 
    lastName, 
    email, 
    phoneNumber, 
    companyName, 
    leadScore, 
    lead_status_id, 
    lead_source_id, 
    lead_category_id 
  } = req.body; 

  const userId = req.session.user.id; 

  const sql = `
    INSERT INTO leads (
      first_name, 
      last_name, 
      email, 
      phone_number, 
      company_name, 
      lead_score, 
      lead_owner_id, 
      created_by, 
      created_at, 
      updated_at, 
      lead_status_id, 
      lead_source_id, 
      lead_category_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)
  `;

  let values = [
    firstName, 
    lastName || null, 
    email, 
    phoneNumber || null, 
    companyName || null, 
    leadScore || 0, 
    userId, 
    userId, 
    lead_status_id,
    lead_source_id,
    lead_category_id 
  ];

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      res.status(500).send('Error connecting to database');
      return;
    }

    connection.query(sql, values, (error, results) => {
      connection.release();

      if (error) {
        console.error('Error inserting data:', error);
        res.status(500).send('Error inserting data');
        return;
      }

      console.log('Data inserted successfully');
      res.redirect('/leads'); 
    });
  });
});


//viewing leads

router.get('/', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized'); // If user is not logged in, render unauthorized page
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      res.status(500).send('Error connecting to database');
      return;
    }

    // Query to check the user's role and admin status
    const checkRoleQuery = 'SELECT user_role_id, is_admin FROM users WHERE user_id = ?';
    connection.query(checkRoleQuery, [req.session.user.id], (err, roleResult) => {
      if (err) {
        console.error('Error retrieving user role:', err);
        connection.release();
        return res.status(500).send('Error retrieving user role');
      }

      if (roleResult.length === 0) {
        connection.release();
        return res.status(404).send('User not found');
      }

      const userRoleId = roleResult[0].user_role_id;
      const isAdmin = roleResult[0].is_admin;

      // Check if the user is either an authorized user (user_role_id = 2) or an admin
      if (userRoleId !== 2 && isAdmin !== 1) {
        connection.release();
        return res.status(403).send('Forbidden: You do not have permission to view leads');
      }

      // If user is valid and has the correct role (2) or is an admin, proceed to query the leads
      let sql;
      if (isAdmin === 1) { 
        // If the user is admin, fetch all leads
        sql = `
          SELECT 
            l.*, 
            CONCAT(u.first_name, " ", u.last_name) AS ownerFullName,
            CONCAT(c.first_name, " ", c.last_name) AS createdByFullName
          FROM 
            leads l
          LEFT JOIN 
            users u ON l.lead_owner_id = u.user_id
          LEFT JOIN 
            users c ON l.created_by = c.user_id
        `;
      } else { 
        // If user is not admin, fetch only leads assigned to them
        sql = `
          SELECT 
            l.*, 
            CONCAT(u.first_name, " ", u.last_name) AS ownerFullName,
            CONCAT(c.first_name, " ", c.last_name) AS createdByFullName
          FROM 
            leads l
          LEFT JOIN 
            users u ON l.lead_owner_id = u.user_id
          LEFT JOIN 
            users c ON l.created_by = c.user_id
          WHERE 
            l.lead_owner_id = ?
        `;
      }

      connection.query(sql, isAdmin === 1 ? [] : [req.session.user.id], (err, leadsResults) => {
        if (err) {
          console.error('Error retrieving leads:', err);
          connection.release();
          res.status(500).send('Error retrieving leads');
          return;
        }

        connection.query('SELECT user_id, CONCAT(first_name, " ", last_name) AS full_name FROM users', (err, usersResults) => {
          if (err) {
            console.error('Error retrieving users:', err);
            connection.release();
            res.status(500).send('Error retrieving users');
            return;
          }

          if (Array.isArray(leadsResults) && leadsResults.length > 0) {
            res.render('leadMainPage', { 
              leads: leadsResults, 
              users: usersResults, 
              currentUser: req.session.user,
              currentUserId: req.session.user.id
            });
          } else {
            console.error('No leads found.');
            connection.release();
            res.render('noLeadFoundPage',{currentUserId: req.session.user.id})
          }
        });
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

      // Fetch the lead details, including its current category
      connection.query(
          `SELECT l.*, s.status_name, u.user_id as owner_user_id, u.first_name as owner_first_name, 
                  u.last_name as owner_last_name, u.email as owner_email, c.category_name 
           FROM leads l 
           LEFT JOIN lead_statuses s ON l.lead_status_id = s.lead_status_id 
           LEFT JOIN users u ON l.lead_owner_id = u.user_id 
           LEFT JOIN lead_categories c ON l.lead_category_id = c.lead_category_id 
           WHERE l.lead_id = ?;`,
          [leadId],
          (error, leadResults) => {
              if (error) {
                  console.error('Error fetching lead:', error);
                  connection.release();
                  res.status(500).send('Error fetching lead data');
                  return;
              }

              if (leadResults.length === 0) {
                  connection.release();
                  return res.status(404).send('Lead not found');
              }

              const lead = leadResults[0];

              // Fetch all lead statuses
              connection.query('SELECT * FROM lead_statuses', (err, statusesResults) => {
                  if (err) {
                      console.error('Error fetching lead statuses:', err);
                      connection.release();
                      res.status(500).send('Error fetching lead statuses');
                      return;
                  }

                  // Fetch all lead categories
                  connection.query('SELECT * FROM lead_categories', (err, categoriesResults) => {
                      if (err) {
                          console.error('Error fetching lead categories:', err);
                          connection.release();
                          res.status(500).send('Error fetching lead categories');
                          return;
                      }

                      // Fetch contact details for the lead
                      connection.query(
                          `SELECT * FROM contact_details WHERE lead_id = ?`,
                          [leadId],
                          (err, contactDetailsResults) => {
                              connection.release(); // Release the connection here
                              if (err) {
                                  console.error('Error fetching contact details:', err);
                                  res.status(500).send('Error fetching contact details');
                                  return;
                              }

                              const contactDetails = contactDetailsResults[0] || {}; // Ensure contactDetails is an object

                              // Render the editLead page with all data
                              res.render('editLead', {
                                  lead,sessionUser: req.session.user ,
                                  statuses: statusesResults,
                                  categories: categoriesResults,
                                  contactDetails, // Pass contact details to the template
                              });
                          }
                      );
                  });
              });
          }
      );
  });
});

// lead update
router.post('/:leadId/edit', (req, res) => {
  const leadId = req.params.leadId;
  const {
      firstName,
      lastName,
      email,
      phone,
      company,
      leadScore,
      lead_status_id,
      lead_category_id, // Get the category ID from the form
      current_address,
      permanent_address,
      phone_number,
      emergency_number // Additional fields for contact details
  } = req.body;

  pool.getConnection((err, connection) => {
      if (err) {
          console.error('Error getting connection from pool:', err);
          res.status(500).send('Error connecting to database');
          return;
      }

      const leadUpdateSql = `
          UPDATE leads 
          SET 
              first_name = ?, 
              last_name = ?, 
              email = ?, 
              phone_number = ?, 
              company_name = ?, 
              lead_score = ?, 
              lead_status_id = ?, 
              lead_category_id = ? 
          WHERE lead_id = ?
      `;

      const leadUpdateValues = [
          firstName || null,
          lastName || null,
          email,
          phone || null,
          company || null,
          leadScore || null,
          lead_status_id,
          lead_category_id, // Add the category ID to the query
          leadId
      ];

      // Update the leads table
      connection.query(leadUpdateSql, leadUpdateValues, (leadError, leadResults) => {
          if (leadError) {
              connection.release();
              console.error('Error updating lead:', leadError);
              res.status(500).send('Error updating lead data');
              return;
          }

          if (leadResults.affectedRows === 0) {
              connection.release();
              return res.status(404).send('Lead not found');
          }

          // Check if contact_details exist for this lead
          const contactDetailsCheckSql = `SELECT * FROM contact_details WHERE lead_id = ?`;
          connection.query(contactDetailsCheckSql, [leadId], (contactError, contactResults) => {
              if (contactError) {
                  connection.release();
                  console.error('Error checking contact details:', contactError);
                  res.status(500).send('Error checking contact details');
                  return;
              }

              if (contactResults.length > 0) {
                  // Update contact_details if they exist
                  const contactUpdateSql = `
                      UPDATE contact_details 
                      SET 
                          current_address = ?, 
                          permanent_address = ?, 
                          phone_number = ?, 
                          emergency_number = ?
                      WHERE lead_id = ?
                  `;

                  const contactUpdateValues = [
                      current_address || null,
                      permanent_address || null,
                      phone_number || null,
                      emergency_number || null,
                      leadId
                  ];

                  connection.query(contactUpdateSql, contactUpdateValues, (updateError) => {
                      connection.release();
                      if (updateError) {
                          console.error('Error updating contact details:', updateError);
                          res.status(500).send('Error updating contact details');
                          return;
                      }

                      res.redirect('/leads'); // Redirect after successful update
                  });
              } else {
                  // Insert new contact_details if they do not exist
                  const contactInsertSql = `
                      INSERT INTO contact_details 
                      (lead_id, current_address, permanent_address, phone_number, emergency_number) 
                      VALUES (?, ?, ?, ?, ?)
                  `;

                  const contactInsertValues = [
                      leadId,
                      current_address || null,
                      permanent_address || null,
                      phone_number || null,
                      emergency_number || null
                  ];

                  connection.query(contactInsertSql, contactInsertValues, (insertError) => {
                      connection.release();
                      if (insertError) {
                          console.error('Error inserting contact details:', insertError);
                          res.status(500).send('Error inserting contact details');
                          return;
                      }

                      res.redirect('/leads'); // Redirect after successful update
                  });
              }
          });
      });
  });
});

// Route to render lead page (including tasks and activities)
router.get('/:lead_id', (req, res) => {
  const { lead_id } = req.params;
  const { template_id } = req.query; // Get the selected template_id from the query string

  pool.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to connect to database.');
    }

    connection.query('SELECT * FROM leads WHERE lead_id = ?', [lead_id], (err, lead) => {
      if (err) {
        connection.release();
        console.error(err);
        return res.status(500).send('Failed to fetch lead details.');
      }

      connection.query('SELECT * FROM tasks WHERE lead_id = ?', [lead_id], (err, tasks) => {
        if (err) {
          connection.release();
          console.error(err);
          return res.status(500).send('Failed to fetch tasks.');
        }

        connection.query('SELECT * FROM lead_activities WHERE lead_id = ?', [lead_id], (err, activities) => {
          if (err) {
            connection.release();
            console.error(err);
            return res.status(500).send('Failed to fetch activities.');
          }

          // Fetch permissions for the lead owner (lead.lead_owner_id)
          connection.query('SELECT * FROM permissions WHERE user_id = ?', [lead[0].lead_owner_id], (err, permissions) => {
            if (err) {
              connection.release();
              console.error(err);
              return res.status(500).send('Failed to fetch permissions.');
            }

            // Fetch all email templates
            connection.query('SELECT * FROM email_template', (err, emailTemplates) => {
              if (err) {
                connection.release();
                console.error(err);
                return res.status(500).send('Failed to fetch email templates.');
              }

              // Set the selected template if any
              let selectedTemplate = null;
              if (template_id) {
                selectedTemplate = emailTemplates.find(template => template.email_template_id == template_id);
              }

              // Format the activity_date to remove time
              activities = activities.map(activity => {
                activity.activity_date = new Date(activity.activity_date).toLocaleDateString('en-IN');
                return activity;
              });

              tasks = tasks.map(task => {
                task.due_date = new Date(task.due_date).toLocaleDateString('en-IN');
                return task;
              });

              // Render the lead details page with the permissions and other data
              res.render('leadDetail', {
                lead: lead[0],
                tasks,
                activities,
                permissions,  // Pass the permissions to the view
                emailTemplates,  // Pass the email templates to the view
                selectedTemplate, // Pass the selected template (if any)
              });
            });
          });
        });
      });
    });
  });
});


// Route to add a new task
router.post('/:lead_id/addTask', (req, res) => {
  const { lead_id } = req.params;
  const { task_name, task_description, due_date } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to connect to database.');
    }

    connection.query(
      'INSERT INTO tasks (task_name, task_description, due_date, completed, lead_id) VALUES (?, ?, ?, false, ?)',
      [task_name, task_description, due_date, lead_id],
      (err) => {
        connection.release();
        if (err) {
          console.error(err);
          return res.status(500).send('Failed to add task.');
        }
        res.redirect(`/leads/${lead_id}`);
      }
    );
  });
});

// Route to add a new activity
router.post('/:lead_id/addActivity', (req, res) => {
  const { lead_id } = req.params;
  const { activity_type, activity_date, activity_detail } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to connect to database.');
    }

    connection.query(
      'INSERT INTO lead_activities (activity_type, activity_date, activity_details, lead_id) VALUES (?, ?, ?, ?)',
      [activity_type, activity_date, activity_detail, lead_id],
      (err) => {
        connection.release();
        if (err) {
          console.error(err);
          return res.status(500).send('Failed to add activity.');
        }
        res.redirect(`/leads/${lead_id}`);
      }
    );
  });
});

// Route to toggle task completion
router.post('/tasks/:task_id/toggleCompletion', (req, res) => {
  const { task_id } = req.params;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to connect to database.');
    }

    connection.query('SELECT completed,lead_id FROM tasks WHERE task_id = ?', [task_id], (err, task) => {
      if (err) {
        connection.release();
        console.error(err);
        return res.status(500).send('Failed to fetch task status.');
      }

      // Convert TINYINT (0 or 1) to boolean
      const currentStatus = task[0].completed === 1; // true if 1, false if 0
      const newStatus = !currentStatus;

      connection.query('UPDATE tasks SET completed = ? WHERE task_id = ?', [newStatus ? 1 : 0, task_id], (err) => {
        connection.release();
        if (err) {
          console.error(err);
          return res.status(500).send('Failed to update task status.');
        }
         res.redirect(`/leads/${task[0].lead_id}`);
      });
    });
  });
});


// Route to delete a task
router.post('/tasks/:task_id/delete', (req, res) => {
  const { task_id } = req.params;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to connect to database.');
    }

    connection.query('DELETE FROM tasks WHERE task_id = ?', [task_id], (err) => {
      connection.release();
      if (err) {
        console.error(err);
        return res.status(500).send('Failed to delete task.');
      }
      res.redirect('back');
    });
  });
});
// Route to send an email
router.post('/:lead_id/sendEmail', (req, res) => {
  const { lead_id } = req.params;
  const { subject, body, email_template_id } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      return res.status(500).send('Failed to connect to database.');
    }

    // Fetch lead details
    connection.query('SELECT email, first_name, last_name FROM leads WHERE lead_id = ?', [lead_id], (err, lead) => {
      if (err || lead.length === 0) {
        connection.release();
        console.error(err || 'Lead not found.');
        return res.status(500).send('Failed to fetch lead details.');
      }

      const { email, first_name, last_name } = lead[0];

      // Fetch email template if provided
      if (email_template_id) {
        connection.query('SELECT template_subject, template_description FROM email_template WHERE email_template_id = ?', [email_template_id], (err, template) => {
          if (err || template.length === 0) {
            connection.release();
            console.error(err || 'Email template not found.');
            return res.status(500).send('Failed to fetch email template details.');
          }

          const { template_subject, template_description } = template[0];

       

          const emailSubject = hasEditMailPermission ? subject : template_subject;
          const emailBody = hasEditMailPermission ? body : template_description;

          // Send email
          sendEmail(connection, email, first_name, last_name, emailSubject, emailBody, res, lead_id);
        });
      } else {
        // If no template is selected, use the provided subject and body (they will be populated by the user or template)
        const emailSubject = subject;
        const emailBody = body;

        // Send email
        sendEmail(connection, email, first_name, last_name, emailSubject, emailBody, res, lead_id);
      }
    });
  });
});

// Function to send the email
function sendEmail(connection, email, first_name, last_name, subject, body, res, lead_id) {
  const personalizedBody =`Dear ${first_name} ${last_name},\n\n${body}\n\nYours faithfully,\nCRM Team`;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'anuragpokhriyal174@gmail.com', // Company email
      pass: 'lteg spzm fjjn qkvt',         // App-specific password
    },
    tls: {
      rejectUnauthorized: false,           // Allow self-signed certificates
    },
  });

  const mailOptions = {
    from: 'anuragpokhriyal174@gmail.com',  // Sender's email
    to: email,                             // Lead's email
    subject,
    text: personalizedBody,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    connection.release(); // Release the connection back to the pool

    if (error) {
      console.error('Error sending email:', error);
      return res.status(500).send('Failed to send email.');
    }
    console.log('Email sent:', info.response);
    res.redirect(`/leads/${lead_id}`);  // Redirect back to the lead page
  });
}

module.exports = router;



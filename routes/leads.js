const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

const pool = require('../database/connection');

router.get('/create', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized');
  }

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

          // Fetch the logged-in user's owner details (first and last name)
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
            console.log('Owner details:', user); // Add this log to debug

            // Release the connection and render the lead creation form
            connection.release();
            console.log('Lead statuses:', statuses); // Log the statuses
            console.log('Lead sources:', leadSources); // Log the lead sources
            console.log('Lead categories:', leadCategories); // Log the lead categories

            // Check if data is correct
            res.render('leadForm', { statuses, leadSources, leadCategories, user });
          });
        });
      });
    });
  });
});





router.post('/create', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized');
  }

  const { 
    firstName, 
    lastName, 
    email, 
    phoneNumber, 
    companyName, 
    leadScore, 
    lead_status_id, 
    lead_source_id, 
    lead_category_id // Get the category ID from the form
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
    userId, // Set `created_by` to the currently logged-in user
    lead_status_id,
    lead_source_id,
    lead_category_id // Add the category ID to the values
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
      return res.render('unauthorized')
    }
  
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting connection from pool:', err);
        res.status(500).send('Error connecting to database');
        return;
      }
  
      let sql;
      if (req.session.user && req.session.user.is_admin === 1) { 
        // If user is admin, fetch all leads
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
  
      connection.query(sql, req.session.user.is_admin === 1 ? [] : [req.session.user.id], (err, leadsResults) => {
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
              currentUser: req.session.user ,
              currentUserId: req.session.user.id

            });
          } else {
            console.error('No leads found.');
            connection.release();
            res.status(404).send('No leads found.'); 
          }
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
          `SELECT l.*, s.status_name, u.user_id as owner_user_id, u.first_name as owner_first_name, u.last_name as owner_last_name, u.email as owner_email, c.category_name 
           FROM leads l 
           LEFT JOIN lead_statuses s ON l.lead_status_id = s.lead_status_id 
           LEFT JOIN users u ON l.lead_owner_id = u.user_id 
           LEFT JOIN lead_categories c ON l.lead_category_id = c.lead_category_id 
           WHERE l.lead_id = ?;`, 
          [leadId], 
          (error, results) => {
              if (error) {
                  console.error('Error fetching lead:', error);
                  connection.release();
                  res.status(500).send('Error fetching lead data');
                  return;
              }

              if (results.length === 0) {
                  connection.release();
                  return res.status(404).send('Lead not found');
              }

              const lead = results[0];

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
                      connection.release(); // Release the connection here
                      if (err) {
                          console.error('Error fetching lead categories:', err);
                          res.status(500).send('Error fetching lead categories');
                          return;
                      }

                      // Render the editLead page with lead data, statuses, and categories
                      res.render('editLead', { 
                          lead, 
                          statuses: statusesResults, 
                          categories: categoriesResults 
                      });
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
      lead_category_id // Get the category ID from the form
  } = req.body;

  pool.getConnection((err, connection) => {
      if (err) {
          console.error('Error getting connection from pool:', err);
          res.status(500).send('Error connecting to database');
          return;
      }

      const sql = `
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

      const values = [
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

      connection.query(sql, values, (error, results) => {
          connection.release();

          if (error) {
              console.error('Error updating lead:', error);
              res.status(500).send('Error updating lead data');
              return;
          }

          if (results.affectedRows === 0) {
              return res.status(404).send('Lead not found');
          }

          res.redirect('/leads'); // Redirect to the leads main page after a successful update
      });
  });
});


// Route to render lead page (including tasks and activities)
router.get('/:lead_id', (req, res) => {
  const { lead_id } = req.params;

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
          connection.release();
          if (err) {
            console.error(err);
            return res.status(500).send('Failed to fetch activities.');
          }

          // Format the activity_date to remove time
          activities = activities.map(activity => {
            activity.activity_date = new Date(activity.activity_date).toLocaleDateString('en-IN'); // Modify the format if needed
            return activity;
          });
          tasks = tasks.map(task => {
            task.due_date = new Date(task.due_date).toLocaleDateString('en-IN'); // Modify the format if needed
            return task;
          });

          res.render('leadDetail', {
            lead: lead[0],
            tasks,
            activities,
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
  const { subject, body } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      return res.status(500).send('Failed to connect to database.');
    }

    connection.query('SELECT email, first_name, last_name FROM leads WHERE lead_id = ?', [lead_id], (err, lead) => {
      connection.release();
      if (err || lead.length === 0) {
        console.error(err || 'Lead not found.');
        return res.status(500).send('Failed to fetch lead details.');
      }

      const { email, first_name, last_name } = lead[0];
      const personalizedBody = `Dear ${first_name} ${last_name},\n\n${body}`;

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'anuragpokhriyal174@gmail.com',  // company mail address
          pass: 'gxet sasg qmli qrhx' 
        },
        tls: {
          rejectUnauthorized: false  // This allows self-signed certificates
        }
      });

      const mailOptions = {
        from: 'anuragpokhriyal174@gmail.com',   // Sender's email (logged-in user)
        to: email,          // Lead's email
        subject,
        text: personalizedBody,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error);
          return res.status(500).send('Failed to send email.');
        }
        console.log('Email sent:', info.response);
        res.redirect(`/leads/${lead_id}`);  // Redirect back to the lead page
      });
    });
  });
});



module.exports = router;



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
  const query = 'SELECT user_role_id, is_admin ,is_manager FROM users WHERE user_id = ?';

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting database connection:', err);

      //server error
      return res.status(500).send('Internal Server Error');
    }

      connection.query(query, [userId], (err, results) => {
      connection.release(); // Always release the connection back to the pool

      if (err) {
        console.error('Error querying database:', err);

        //server error
        return res.status(500).send('Internal Server Error');
      }

      if (results.length === 0) {
        //user not found
        return res.status(404).send('User not found');
      }

      const userRoleId = results[0].user_role_id;
      const isAdmin = results[0].is_admin;
      const isManager=results[0].is_manager;

      // Check if the user is either role 2 (authorized user) or admin
      if (userRoleId !== 2 && isAdmin !== 1 && isManager!==1) {
        return res.status(403).send('Forbidden: You do not have access to this resource');
      }

      next(); // User has the correct role, proceed to the next middleware or route handler
    });
  });
}




// GET /create route with role check
router.get('/create', checkUserRole, (req, res) => {
  try {
    if (!req.session.user) {
      return res.render('unauthorized'); // If user is not logged in, render unauthorized page
    }

    const userId = req.session.user.id; // Get the logged-in user's ID

    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting connection from pool:', err);
        //server error
        
      const errorMessage='Error connecting to database'
      return res.render('error',{errorMessage})
       
      }

      // Fetch lead statuses
      connection.query('SELECT * FROM lead_statuses', (err, statuses) => {
        if (err) {
          console.error('Error fetching lead statuses:', err);
          connection.release();
          //server error
          const errorMessage='Error fetching lead statuses'
          return res.render('error',{errorMessage})
          
        }

        // Fetch lead sources
        connection.query('SELECT * FROM lead_sources', (err, leadSources) => {
          if (err) {
            console.error('Error fetching lead sources:', err);
            connection.release();
            //server error
            const errorMessage='Error fetching lead sources'
            return res.render('error',{errorMessage})
            
          }

          // Fetch lead categories
          connection.query('SELECT * FROM lead_categories', (err, leadCategories) => {
            if (err) {
              console.error('Error fetching lead categories:', err);
              connection.release();
              //server error
              const errorMessage='Error fetching lead categories'
              return res.render('error',{errorMessage})
              
            }

            // Fetch the logged-in user's owner details
            connection.query('SELECT user_id, first_name, last_name FROM users WHERE user_id = ?', [userId], (err, ownerDetails) => {
              if (err) {
                console.error('Error fetching owner details:', err);
                connection.release();
                //server error
                const errorMessage='Error fetching owner details'
                return res.render('error',{errorMessage})
              
              }

              if (ownerDetails.length === 0) {
                connection.release();
                //user not found

                const errorMessage='User not found'
                return res.render('error',{errorMessage})
                
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
  } catch (error) {
    console.error('Unexpected error occurred:', error);

    const errorMessage='Internal server error'
    return res.render('error',{errorMessage})
   
  }
});

// POST /create route with role check
router.post('/create', checkUserRole, (req, res) => {
  try {
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
        //server error

        const errorMessage='Error connecting to database'
        return res.render('error',{errorMessage})
        
      }

      connection.query(sql, values, (error, results) => {
        connection.release();

        if (error) {
          console.error('Error inserting data:', error);
          //something went wrong
          const errorMessage='Error inserting data'
          return res.render('error',{errorMessage})
          
        }

        console.log('Data inserted successfully');
        res.redirect('/leads');
      });
    });
  } catch (error) {
    console.error('Unexpected error occurred:', error);

    const errorMessage='Internal server error'
    return res.render('error',{errorMessage})
    
  }
});


//viewing leads
router.get('/', (req, res) => {
  try {
    if (!req.session.user) {
      return res.render('unauthorized'); // If user is not logged in, render unauthorized page
    }

    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting connection from pool:', err);
        //server error

        const errorMessage='Error connecting to database'
        return res.render('error',{errorMessage})
        
      }

      // Query to check the user's role and admin status
      const checkRoleQuery = 'SELECT user_role_id, is_admin,is_manager FROM users WHERE user_id = ?';
      connection.query(checkRoleQuery, [req.session.user.id], (err, roleResult) => {
        if (err) {
          console.error('Error retrieving user role:', err);
          connection.release();
          //server error
          const errorMessage='Error retrieving user role'
          return res.render('error',{errorMessage})
          
        }

        if (roleResult.length === 0) {
          connection.release();
          //user not found

          const errorMessage='User not found'
          return res.render('error',{errorMessage})
          
        }

        const userRoleId = roleResult[0].user_role_id;
        const isAdmin = roleResult[0].is_admin;
        const isManager=roleResult[0].is_manager;

        // Check if the user is either an authorized user (user_role_id = 2) or an admin
        if (userRoleId !== 2 && isAdmin !== 1 && isManager!==1) {
          connection.release();

          const errorMessage='You do not have permission to view leads'
          return res.render('error',{errorMessage})
         
        }

        // Get the filter value from query parameters (if provided), default to 'all'
        const filterStatus = req.query.status || 'all';

        // SQL query based on user role and filter
        let sql;
        if (isAdmin === 1) {
          // If the user is admin, fetch all leads
          sql = `SELECT 
                  l.*, 
                  CONCAT(u.first_name, " ", u.last_name) AS ownerFullName,
                  CONCAT(c.first_name, " ", c.last_name) AS createdByFullName,
                  ls.status_name AS leadStatusName
                 FROM leads l
                 LEFT JOIN users u ON l.lead_owner_id = u.user_id
                 LEFT JOIN users c ON l.created_by = c.user_id
                 LEFT JOIN lead_statuses ls ON l.lead_status_id = ls.lead_status_id`;

          // Apply filter based on status
          if (filterStatus === 'open') {
            sql += ` WHERE ls.lead_status_categories = 'open'`;
          } else if (filterStatus === 'close') {
            sql += ` WHERE ls.lead_status_categories = 'close'`;
          }

        } else {
          // If user is not admin, fetch only leads assigned to them
          sql = `SELECT 
                  l.*, 
                  CONCAT(u.first_name, " ", u.last_name) AS ownerFullName,
                  CONCAT(c.first_name, " ", c.last_name) AS createdByFullName,
                  ls.status_name AS leadStatusName
                 FROM leads l
                 LEFT JOIN users u ON l.lead_owner_id = u.user_id
                 LEFT JOIN users c ON l.created_by = c.user_id
                 LEFT JOIN lead_statuses ls ON l.lead_status_id = ls.lead_status_id
                 WHERE l.lead_owner_id = ?`;

          // Apply filter based on status
          if (filterStatus === 'open') {
            sql += ` AND ls.lead_status_categories = 'open'`;
          } else if (filterStatus === 'close') {
            sql += ` AND ls.lead_status_categories = 'close'`;
          }
        }

        connection.query(sql, isAdmin === 1 ? [] : [req.session.user.id], (err, leadsResults) => {
          if (err) {
            console.error('Error retrieving leads:', err);
            connection.release();
            //server error

            const errorMessage='Error retrieving leads'
          return res.render('error',{errorMessage})
            
            return;
          }

          connection.query('SELECT user_id, CONCAT(first_name, " ", last_name) AS full_name FROM users where user_role_id in (2,7)', (err, usersResults) => {
            if (err) {
              console.error('Error retrieving users:', err);
              connection.release();
              //server error

              const errorMessage='Error retrieving users'
              return res.render('error',{errorMessage})
            
              
            }

            connection.release();
            res.render('leadMainPage', {
              leads: leadsResults,
              users: usersResults,
              currentUser: req.session.user,
              currentUserId: req.session.user.id,
              selectedFilter: filterStatus // Pass the filter status to EJS
            });
          });
        });
      });
    });
  } catch (error) {
    console.error('Unexpected error occurred:', error);
    const errorMessage='Internal server error'
    return res.render('error',{errorMessage})
  }
});


// Assign lead to user
router.post('/:leadId/assign', (req, res) => {
  try {
    const leadId = req.params.leadId;
    const selectedUserId = req.body.selectedUserId;

    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting connection from pool:', err);
        //server error
        const errorMessage='Error connecting to database'
        return res.render('error',{errorMessage})
        
      }

      // Update the lead owner_id directly using the provided selectedUserId
      const updateQuery = 'UPDATE leads SET lead_owner_id = ? WHERE lead_id = ?';
      connection.query(updateQuery, [selectedUserId, leadId], (err, results) => {
        connection.release();

        if (err) {
          console.error('Error updating lead owner:', err);
          // something went wrong
          const errorMessage='Error updating lead owner'
          return res.render('error',{errorMessage})
          // res.status(500).send('Error updating lead owner: ' + err.message);
          // return;
        }

        if (results.affectedRows === 0) {
          console.error('No rows were affected by the UPDATE query.');
          // something went wrong

          const errorMessage='Lead not found or update failed'
          return res.render('error',{errorMessage})
          
          
        }

        res.json({ message: 'Lead owner updated successfully' });
      });
    });
  } catch (error) {
    console.error('Unexpected error occurred:', error);
    const errorMessage='Internal server error'
    return res.render('error',{errorMessage})
  }
});


//lead udpate 
// Edit Lead Page
router.get('/:leadId/edit', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized'); // If user is not logged in, render unauthorized page
  }
  const leadId = req.params.leadId;

  console.log("Received leadId:", leadId);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      const errorMessage='Error connecting to database'
        return res.render('error',{errorMessage})
     
    }

    try {
      // Fetch the lead details, including its current category
      connection.query(
        `SELECT l.*, s.status_name, s.lead_status_categories, u.user_id as owner_user_id, 
                u.first_name as owner_first_name, u.last_name as owner_last_name, 
                u.email as owner_email, c.category_name 
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

            const errorMessage='Error fetching lead data'
          return res.render('error',{errorMessage})
           
          }

          if (leadResults.length === 0) {
            connection.release();

            const errorMessage='Lead not found'
            return res.render('error',{errorMessage})
           
          }

          const lead = leadResults[0];

          // Fetch all lead statuses
          connection.query('SELECT * FROM lead_statuses', (err, statusesResults) => {
            if (err) {
              console.error('Error fetching lead statuses:', err);
              connection.release();

              const errorMessage='Error fetching lead statuses'
            return res.render('error',{errorMessage})
            
            }

            // Fetch all lead categories
            connection.query('SELECT * FROM lead_categories', (err, categoriesResults) => {
              if (err) {
                console.error('Error fetching lead categories:', err);
                connection.release();

                const errorMessage='Error fetching lead categories'
                return res.render('error',{errorMessage})
                
              }

              // Fetch contact details for the lead
              connection.query(
                `SELECT * FROM contact_details WHERE lead_id = ?`,
                [leadId],
                (err, contactDetailsResults) => {
                  connection.release();
                  if (err) {
                    console.error('Error fetching contact details:', err);
                    const errorMessage='Error fetching contact details'
                    return res.render('error',{errorMessage})
                    
                  }

                  const contactDetails = contactDetailsResults[0] || {}; // Ensure contactDetails is an object

                  // Render the editLead page with all data
                  res.render('editLead', {
                    lead,
                    sessionUser: req.session.user,
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
    } catch (error) {
      console.error('Unexpected error occurred:', error);
      const errorMessage='Internal server error'
      return res.render('error',{errorMessage})
    }
  });
});

// Lead Update
router.post('/:leadId/edit', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized'); // If user is not logged in, render unauthorized page
  }
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
      const errorMessage='Error connecting to database'
        return res.render('error',{errorMessage})
     
    }

    try {
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

          const errorMessage='Error updating lead data'
          return res.render('error',{errorMessage})
          
        }

        if (leadResults.affectedRows === 0) {
          connection.release();
          const errorMessage='Lead not found'
          return res.render('error',{errorMessage})
          
        }

        // Check if contact_details exist for this lead
        const contactDetailsCheckSql = `SELECT * FROM contact_details WHERE lead_id = ?`;
        connection.query(contactDetailsCheckSql, [leadId], (contactError, contactResults) => {
          if (contactError) {
            connection.release();
            console.error('Error checking contact details:', contactError);

            const errorMessage='Error checking contact details'
            return res.render('error',{errorMessage})
            
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

                const errorMessage='Error updating contact details'
               return res.render('error',{errorMessage})
               
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

                const errorMessage='Error inserting contact details'
                return res.render('error',{errorMessage})
               
              }

              res.redirect('/leads'); // Redirect after successful update
            });
          }
        });
      });
    } catch (error) {
      connection.release();
      console.error('Unexpected error occurred:', error);
      const errorMessage='Internal server error'
       return res.render('error',{errorMessage})
    }
  });
});

//when lead is won , this opportunitites route will run
// Route to fetch opportunities
router.get('/opportunities', (req, res) => {
  try {
    if (!req.session.user) {
      return res.render('unauthorized');
    }

    var currentUserId = req.session.user.id;
    console.log(currentUserId);

    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting connection from pool:', err);
        const errorMessage='Internal Server Error'
        return res.render('error',{errorMessage})
      }

      const query = `
        SELECT 
          leads.lead_id,
          leads.first_name,
          leads.last_name,
          leads.phone_number,
          leads.email,
          leads.company_name,
          contact_details.*  
        FROM leads
        JOIN lead_statuses 
          ON leads.lead_status_id = lead_statuses.lead_status_id
        JOIN contact_details
          ON leads.lead_id = contact_details.lead_id
        WHERE lead_statuses.status_name = 'won';
      `;
      
      connection.query(query, (queryErr, results) => {
        connection.release();
        if (queryErr) {
          console.error('Error executing query:', queryErr);

          const errorMessage='Internal Server Error'
          return res.render('error',{errorMessage})
          
        }

        console.log(results.length);
        res.render('opportunities', { leads: results, currentUserId });
      });
    });
  } catch (err) {
    console.error('Error in GET /opportunities:', err);
    res.status(500).send('Internal Server Error');
  }
});

// View won lead contact
router.get('/opportunities/contact', (req, res) => {
  try {
    if (!req.session.user) {
      return res.render('unauthorized');
    }

    var currentUserId = req.session.user.id;
    console.log(currentUserId);

    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting connection from pool:', err);

        const errorMessage='Internal Server Error'
          return res.render('error',{errorMessage})
     
      }

      const query = `
        SELECT 
          l.first_name,
          l.last_name,
          l.email,
          cd.phone_number,
          cd.emergency_number,
          cd.current_address,
          cd.permanent_address
        FROM 
          leads l
        JOIN 
          contact_details cd ON l.lead_id = cd.lead_id;
      `;
      
      connection.query(query, (error, result) => {
        connection.release();
        if (error) {
          console.error('Error executing query:', error);
          const errorMessage='Internal server error'
          return res.render('error',{errorMessage})
        }

        const wonLeads = result[0];
        res.render('leadContact', { wonLeads, currentUserId });
      });
    });
  } catch (err) {
    console.error('Error in GET /opportunities/contact:', err);
    const errorMessage='Internal server error'
    return res.render('error',{errorMessage})
  }
});

// Route to render lead page (including tasks and activities)
router.get('/:lead_id', (req, res) => {
  try {
    if (!req.session.user) {
      return res.render('unauthorized');
    }

    const { lead_id } = req.params;
    const { template_id } = req.query;

    pool.getConnection((err, connection) => {
      if (err) {
        console.error(err);
        const errorMessage='Error connecting to database'
        return res.render('error',{errorMessage})
      }

      connection.query('SELECT * FROM leads WHERE lead_id = ?', [lead_id], (err, lead) => {
        if (err) {
          connection.release();
          console.error(err);
          const errorMessage='Failed to fetch lead details.'
          return res.render('error',{errorMessage})
          
        }

        connection.query('SELECT * FROM tasks WHERE lead_id = ?', [lead_id], (err, tasks) => {
          if (err) {
            connection.release();
            console.error(err);
            const errorMessage='Failed to fetch tasks.'
            return res.render('error',{errorMessage})
           
          }

          connection.query('SELECT * FROM lead_activities WHERE lead_id = ?', [lead_id], (err, activities) => {
            if (err) {
              connection.release();
              console.error(err);

              const errorMessage='Failed to fetch activities.'
              return res.render('error',{errorMessage})
              
            }

            connection.query('SELECT * FROM permissions WHERE user_id = ?', [lead[0].lead_owner_id], (err, permissions) => {
              if (err) {
                connection.release();
                console.error(err);
                const errorMessage='Failed to fetch permissions'
                return res.render('error',{errorMessage})
               
              }

              connection.query('SELECT * FROM email_template', (err, emailTemplates) => {
                if (err) {
                  connection.release();
                  console.error(err);
                  const errorMessage='Failed to fetch email templates.'
                  return res.render('error',{errorMessage})
                  
                }

                let selectedTemplate = null;
                if (template_id) {
                  selectedTemplate = emailTemplates.find(template => template.email_template_id == template_id);
                }

                activities = activities.map(activity => {
                  activity.activity_date = new Date(activity.activity_date).toLocaleDateString('en-IN');
                  return activity;
                });

                tasks = tasks.map(task => {
                  task.due_date = new Date(task.due_date).toLocaleDateString('en-IN');
                  return task;
                });

                res.render('leadDetail', {
                  lead: lead[0],
                  tasks,
                  activities,
                  permissions,
                  emailTemplates,
                  selectedTemplate,
                });
              });
            });
          });
        });
      });
    });
    
  } catch (err) {
    console.error('Error in GET /:lead_id:', err);
    const errorMessage='Internal server error'
    return res.render('error',{errorMessage})
  }
});


// Route to add a new task
// Route to add a new task
router.post('/:lead_id/addTask', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized'); // If user is not logged in, render unauthorized page
  }
  const { lead_id } = req.params;
  const { task_name, task_description, due_date } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      const errorMessage='Error connecting to database'
        return res.render('error',{errorMessage})
    }

    try {
      connection.query(
        'INSERT INTO tasks (task_name, task_description, due_date, completed, lead_id) VALUES (?, ?, ?, false, ?)',
        [task_name, task_description, due_date, lead_id],
        (err) => {
          connection.release();
          if (err) {
            console.error(err);

            const errorMessage='Failed to add task.'
            return res.render('error',{errorMessage})
           
          }
          res.redirect(`/leads/${lead_id}`);
        }
      );
    } catch (error) {
      connection.release();
      console.error('Error:', error);
      const errorMessage='Failed to add task.'
      return res.render('error',{errorMessage})
     
    }
  });
});

// Route to add a new activity
router.post('/:lead_id/addActivity', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized'); // If user is not logged in, render unauthorized page
  }
  const { lead_id } = req.params;
  const { activity_type, activity_date, activity_detail } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      const errorMessage='Error connecting to database'
        return res.render('error',{errorMessage})
    }

    try {
      connection.query(
        'INSERT INTO lead_activities (activity_type, activity_date, activity_details, lead_id) VALUES (?, ?, ?, ?)',
        [activity_type, activity_date, activity_detail, lead_id],
        (err) => {
          connection.release();
          if (err) {
            console.error(err);
            const errorMessage='Failed to add activity.'
            return res.render('error',{errorMessage})
            
          }
          res.redirect(`/leads/${lead_id}`);
        }
      );
    } catch (error) {
      connection.release();
      console.error('Error:', error);
      const errorMessage='Internal server error'
    return res.render('error',{errorMessage})
    }
  });
});

// Route to toggle task completion
router.post('/tasks/:task_id/toggleCompletion', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized'); // If user is not logged in, render unauthorized page
  }
  const { task_id } = req.params;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      const errorMessage='Error connecting to database'
      return res.render('error',{errorMessage})
    }

    try {
      connection.query('SELECT completed, lead_id FROM tasks WHERE task_id = ?', [task_id], (err, task) => {
        if (err) {
          connection.release();
          console.error(err);

          const errorMessage='Failed to fetch task status.'
            return res.render('error',{errorMessage})
         
        }

        // Convert TINYINT (0 or 1) to boolean
        const currentStatus = task[0].completed === 1; // true if 1, false if 0
        const newStatus = !currentStatus;

        connection.query('UPDATE tasks SET completed = ? WHERE task_id = ?', [newStatus ? 1 : 0, task_id], (err) => {
          connection.release();
          if (err) {
            console.error(err);

            const errorMessage='Failed to update task status..'
            return res.render('error',{errorMessage})
            
          }
          res.redirect(`/leads/${task[0].lead_id}`);
        });
      });
    } catch (error) {
      connection.release();
      console.error('Error:', error);
      const errorMessage='Failed to update task status.'
      return res.render('error',{errorMessage})
     
    }
  });
});

// Route to delete a task
router.post('/tasks/:task_id/delete', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized'); // If user is not logged in, render unauthorized page
  }
  const { task_id } = req.params;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      const errorMessage='Error connecting to database'
      return res.render('error',{errorMessage})
    }

    try {
      connection.query('DELETE FROM tasks WHERE task_id = ?', [task_id], (err) => {
        connection.release();
        if (err) {
          console.error(err);

          const errorMessage='Failed to delete task.'
          return res.render('error',{errorMessage})
          
        }
        res.redirect('back');
      });
    } catch (error) {
      connection.release();
      console.error('Error:', error);

      const errorMessage='Failed to delete task..'
      return res.render('error',{errorMessage})
     
    }
  });
});

// Route to send an email
router.post('/:lead_id/sendEmail', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized'); // If user is not logged in, render unauthorized page
  }
  const { lead_id } = req.params;
  const { subject, body, email_template_id } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      const errorMessage='Error connecting to database'
      return res.render('error',{errorMessage})
    }

    try {
      // Fetch lead details
      connection.query('SELECT email, first_name, last_name FROM leads WHERE lead_id = ?', [lead_id], (err, lead) => {
        if (err || lead.length === 0) {
          connection.release();
          console.error(err || 'Lead not found.');

          const errorMessage='Failed to fetch lead details.'
          return res.render('error',{errorMessage})
          
        }

        const { email, first_name, last_name } = lead[0];

        // Fetch email template if provided
        if (email_template_id) {
          connection.query('SELECT template_subject, template_description FROM email_template WHERE email_template_id = ?', [email_template_id], (err, template) => {
            if (err || template.length === 0) {
              connection.release();
              console.error(err || 'Email template not found.');
              
          const errorMessage='Failed to fetch email template details.'
          return res.render('error',{errorMessage})
             
            }

            const { template_subject, template_description } = template[0];
            const emailSubject = subject || template_subject;
            const emailBody = body || template_description;

            // Send email
            sendEmail(connection, email, first_name, last_name, emailSubject, emailBody, res, lead_id);
          });
        } else {
          // If no template is selected, use the provided subject and body
          const emailSubject = subject;
          const emailBody = body;

          // Send email
          sendEmail(connection, email, first_name, last_name, emailSubject, emailBody, res, lead_id);
        }
      });
    } catch (error) {
      connection.release();
      console.error('Error:', error);

      const errorMessage='Failed to send email.'
       return res.render('error',{errorMessage})
     
    }
  });
});

// Function to send the email
function sendEmail(connection, email, first_name, last_name, subject, body, res, lead_id) {
  const website=''

  const personalizedBody = `Dear ${first_name} ${last_name},<br><br>${body}<br><br>Visit our website:<a href="https://knoqlogico.com">Knoqlogico</a><br>Yours faithfully<br><br>Knoqlogico Team`;
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
    html: personalizedBody,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    connection.release(); // Release the connection back to the pool

    if (error) {
      console.error('Error sending email:', error);
      const errorMessage='Failed to send email.'
      return res.render('error',{errorMessage})
      
    }
    console.log('Email sent:', info.response);
    res.redirect(`/leads/${lead_id}`);  // Redirect back to the lead page
  });
}


module.exports = router;



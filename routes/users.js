const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

const pool = require('../database/connection');

// Register page
// Register page
router.get('/register', (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      res.status(500).render('error', { errorMessage: 'Error connecting to database' });
      return;
    }

    try {
      connection.query('SELECT * FROM roles', (err, results) => {
        if (err) {
          console.error('Error fetching roles:', err);
          connection.release();
          res.render('error', { errorMessage: 'Error fetching roles' });
          return;
        }

        connection.release();
        res.render('userRegistration', { roles: results });
      });
    } catch (error) {
      console.error('Error in /register route:', error);
      connection.release();
      res.status(500).render('error', { errorMessage: 'Unexpected error occurred' });
    }
  });
});

// Register user
router.post('/register', (req, res) => {
  const { firstName, lastName, email, password, roleId } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      return res.render('error', { errorMessage: 'Error connecting to database' });
    }

    try {
      // Check if email already exists
      connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
          console.error('Error checking for existing email:', err);
          connection.release();
          return res.render('error', { errorMessage: 'Error checking for existing email' });
        }

        if (results.length > 0) {
          connection.release();
          return res.render('error', { errorMessage: 'Email already exists' });
        }

        // Hash the password
        bcrypt.hash(password, 10, (err, hash) => {
          if (err) {
            console.error('Error hashing password:', err);
            connection.release();
            return res.status(500).send('Error hashing password');
          }

          // Insert user with hashed password
          const sql = "INSERT INTO users(first_name, last_name, email, user_role_id, password_hash) VALUES(?,?,?,?,?)";
          connection.query(sql, [firstName, lastName, email, roleId, hash], (error, results) => {
            connection.release();

            if (error) {
              console.error('Error inserting data:', error);
              return res.status(500).send('Error inserting data');
            }

            const userId = results.insertId;

            req.session.user = {
              id: userId,
              firstName,
              lastName,
              email,
            };

            req.session.save((err) => {
              if (err) {
                console.error('Error saving session:', err);
                return res.status(500).send('Error saving session');
              }
              res.redirect('/users/login');
            });
          });
        });
      });
    } catch (error) {
      console.error('Unexpected error occurred in /register route:', error);
      connection.release();
      res.render('error', { errorMessage: 'Unexpected error occurred' });
    }
  });
});

//render login page
// Login page
router.get('/login', (req, res) => {
  res.render('login');
});

// Login with credentials
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);

      const errorMessage='Error connecting to database'
      return res.render('error',{errorMessage})
    }

    try {
      connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
          console.error('Error fetching user:', err);
          connection.release();
          
          const errorMessage='Error connecting to database'
          return res.render('error',{errorMessage})
         
        }

        if (results.length === 0) {
          connection.release();
          const errorMessage='Invalid email or password'
          return res.render('error',{errorMessage})
          
          
        }

        const user = results[0];

        bcrypt.compare(password, user.password_hash, (err, isMatch) => {
          if (err) {
            console.error('Error comparing passwords:', err);
            connection.release();

            const errorMessage='Wrong passwords'
            return res.render('error',{errorMessage})
           
          }

          if (isMatch) {
            // Store user data in session
            req.session.user = {
              id: user.user_id,
              firstName: user.first_name,
              lastName: user.last_name,
              email: user.email,  // Store email here
              roleId: user.user_role_id,
              is_admin: user.is_admin,
              is_manager:user.is_manager,
              user_role_id: user.user_role_id
            };

            req.session.save((err) => {
              if (err) {
                console.error('Error saving session:', err);
                connection.release();

                const errorMessage='Error saving session'
                return res.render('error',{errorMessage})
                
              }

              console.log('Session user after login:', req.session.user);
              connection.release();
              res.redirect(`/user/${req.session.user.id}/dashboard`);
            });
          } else {
            connection.release();

            const errorMessage='Invalid email or password'
            return res.render('error',{errorMessage})
           
          }
        });
      });
    } catch (error) {
      console.error('Unexpected error in /login route:', error);
      connection.release();

      const errorMessage='Unexpected error occurred'
      return res.render('error',{errorMessage})
      
    }
  });
});




//view user details
// Viewing user details
router.get('/:userId', (req, res) => {
  const userIdFromUrl = parseInt(req.params.userId, 10);

  if (!req.session.user) {

    return res.render('error', { errorMessage: 'User not authenticated' });
  }

  if (req.session.user.id !== userIdFromUrl && req.session.user.is_admin !== 1) {
    return res.render('unauthorized');
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);

      const errorMessage='Error connecting to database'
      return res.render('error',{errorMessage})
      
    }

    try {
      connection.query(`
        SELECT 
          u.*, 
          r.roles_name AS roleName, 
          cd.current_address, 
          cd.permanent_address, 
          cd.phone_number, 
          cd.emergency_number
        FROM 
          users u
        JOIN 
          roles r ON u.user_role_id = r.role_id
        LEFT JOIN 
          contact_details cd ON u.user_id = cd.contact_user_id
        WHERE 
          u.user_id = ?
      `, [userIdFromUrl], (error, results) => {
        connection.release();

        if (error) {

          console.error('Error fetching user:', error);

          const errorMessage='Error fetching user data'
          return res.render('error',{errorMessage})
          
        }

        if (results.length === 0) {
          const errorMessage='user not found'
          return res.render('error',{errorMessage})
        }

        const isCurrentUser = req.session.user.id === userIdFromUrl;

        // Passing user data and session info to the template
        res.render('userDetail', { 
          user: results[0], 
          isCurrentUser, 
          sessionUser: req.session.user 
        });
      });
    } catch (error) {
      console.error('Unexpected error occurred in fetching user data:', error);
      connection.release();
      const errorMessage='Unexpected error occurred'
      return res.render('error',{errorMessage})
     
    }
  });
});

// Editing user details
router.get('/:userId/edit', (req, res) => {
  const userIdFromUrl = req.params.userId;

  if (!req.session.user) {
    return res.render('unauthorized');
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);

      const errorMessage='Error connecting to database'
      return res.render('error',{errorMessage})
      
    }

    try {
      // Fetch user details along with role name and contact information (if it exists)
      connection.query(`
        SELECT 
            u.*, 
            r.roles_name as roleName, 
            c.*
        FROM 
            users u
        JOIN 
            roles r ON u.user_role_id = r.role_id
        LEFT JOIN 
            contact_details c ON u.user_id = c.contact_user_id
        WHERE 
            u.user_id = ?`, 
        [userIdFromUrl], (err, userResults) => {
          if (err) {
            console.error('Error fetching user:', err);
            connection.release();

            const errorMessage='Error fetching user data'
             return res.render('error',{errorMessage})
           
          }

          if (userResults.length === 0) {
            connection.release();

            const errorMessage='User not found'
             return res.render('error',{errorMessage})
            
          }

          // Fetch all roles for the dropdown
          connection.query('SELECT * FROM roles', (err, rolesResults) => {
            if (err) {
              console.error('Error fetching roles:', err);
              connection.release();
              const errorMessage='Error fetching roles'
             return res.render('error',{errorMessage})
             
            }

            connection.release();
            // Pass the user data and roles to the view
            res.render('editUser', { 
              user: userResults[0], 
              roles: rolesResults, 
              sessionUser: req.session.user 
            });
          });
        });
    } catch (error) {
      console.error('Unexpected error occurred in editing user data:', error);
      connection.release();
      const errorMessage='Unexpected error occurred'
      return res.render('error',{errorMessage})
      
    }
  });
});


//store edited user details
// Updating user details
router.post('/:userId/edit', (req, res) => {
  const userId = req.params.userId;
  const { firstName, lastName, email, roleId, permanentAddress, currentAddress, phoneNumber, emergencyContact } = req.body;

  console.log(req.body); // Debugging the request body

  // Check if user is authenticated
  if (!req.session.user) {
    return res.render('unauthorized');
  }

  const isAdmin = req.session.user.is_admin; // If is_admin is 1, the user is an admin

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);

      const errorMessage='Error connecting to database'
      return res.render('error',{errorMessage})
     
    }

    try {
      // If the user is an admin, update the user details and role
      const updateUserQuery = isAdmin
        ? 'UPDATE users SET first_name = ?, last_name = ?, email = ?, user_role_id = ? WHERE user_id = ?'
        : 'UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE user_id = ?';

      const updateUserParams = isAdmin
        ? [firstName, lastName, email, roleId, userId]
        : [firstName, lastName, email, userId];

      connection.query(updateUserQuery, updateUserParams, (err, result) => {
        if (err) {
          connection.release();
          console.error('Error updating user:', err);

          const errorMessage='Error updating user data'
          return res.render('error',{errorMessage})
         
        }

        if (result.affectedRows === 0) {
          connection.release();

          const errorMessage='User not found'
          return res.render('error',{errorMessage})
         
        }

        // Now update the contact details (if exists)
        const checkContactQuery = 'SELECT * FROM contact_details WHERE contact_user_id = ?';
        connection.query(checkContactQuery, [userId], (err, contactResult) => {
          if (err) {
            connection.release();
            console.error('Error checking contact details:', err);

            const errorMessage='Error checking contact details'
            return res.render('error',{errorMessage})

          }

          let contactQuery;
          let contactParams;

          if (contactResult.length > 0) {
            // If contact exists, update it
            contactQuery = `
              UPDATE contact_details 
              SET current_address = ?, permanent_address = ?, phone_number = ?, emergency_number = ? 
              WHERE contact_user_id = ?
            `;
            contactParams = [currentAddress, permanentAddress, phoneNumber, emergencyContact, userId];
          } else {
            // If contact doesn't exist, insert it
            contactQuery = `
              INSERT INTO contact_details (contact_user_id, current_address, permanent_address, phone_number, emergency_number)
              VALUES (?, ?, ?, ?, ?)
            `;
            contactParams = [userId, currentAddress, permanentAddress, phoneNumber, emergencyContact];
          }

          // Insert or update contact details
          connection.query(contactQuery, contactParams, (err, contactResult) => {
            connection.release();
            if (err) {
              console.error('Error updating/adding contact details:', err);

              const errorMessage='Error updating/adding contact details'
              return res.render('error',{errorMessage})
              
            }

            // Redirect after successfully updating both user and contact details
            res.redirect(`/user/${userId}`);
          });
        });
      });
    } catch (error) {
      connection.release();
      console.error('Unexpected error occurred in updating user details:', error);

      const errorMessage='Unexpected error occurred'
      return res.render('error',{errorMessage})
     
    }
  });
});

// Viewing creator of the leads
router.get('/creator/:creatorId', (req, res) => {
  const creatorId = req.params.creatorId;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);

      const errorMessage='Error connecting to database'
      return res.render('error',{errorMessage})
     
    }

    try {
      connection.query(`
        SELECT 
          u.*, 
          r.roles_name AS roleName, 
          cd.current_address, 
          cd.permanent_address, 
          cd.phone_number, 
          cd.emergency_number
        FROM 
          users u
        LEFT JOIN
          roles r ON u.user_role_id = r.role_id
        LEFT JOIN 
          contact_details cd ON u.user_id = cd.contact_user_id
        WHERE 
          u.user_id = ?
      `, [creatorId], (error, results) => {
        connection.release();

        if (error) {
          console.error('Error fetching user:', error);

          const errorMessage='Error fetching user data'
          return res.render('error',{errorMessage})
          
        }

        if (results.length === 0) {
          const errorMessage='User not found'
          return res.render('error',{errorMessage})
          
        }

        res.render('createdByUserDetail', { user: results[0] });
      });
    } catch (error) {
      connection.release();


      console.error('Unexpected error occurred in fetching creator details:', error);

      const errorMessage='Unexpected error occurred'
      return res.render('error',{errorMessage})
      
    }
  });
});

//view assigned user detail
// Fetching user details for assignment or view

router.get('/assign/:userId', (req, res) => {
  const userId = req.params.userId;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);

      const errorMessage='Error connecting to database'
      return res.render('error',{errorMessage})
     
    }

    try {
      connection.query(
        `SELECT 
          u.*, 
          r.roles_name AS roleName,
          c.current_address,
          c.permanent_address,
          c.phone_number,
          c.emergency_number 
        FROM 
          users u
        JOIN 
          roles r ON u.user_role_id = r.role_id
        LEFT JOIN 
          contact_details c ON u.user_id = c.contact_user_id
        WHERE 
          u.user_id = ?`,
        [userId],
        (err, userResults) => {
          connection.release();

          if (err) {
            console.error('Error fetching user:', err);
            const errorMessage='Error fetching user data'
            return res.render('error',{errorMessage})
           
          }

          if (userResults.length === 0) {

            const errorMessage='User not found'
            return res.render('error',{errorMessage})
            
          }

          const isCurrentUser = req.session.user.id === userId;
          const user = userResults[0];

          // Render the userDetail page with user data and whether the logged-in user is the same as the viewed user
          res.render('userDetail', { user, isCurrentUser });
        }
      );
    } catch (error) {
      console.error('Unexpected error:', error);
      connection.release();
      const errorMessage='Unexpected error occurred'
      return res.render('error',{errorMessage})
      
    }
  });
});

// <<<<<----- Admin Section ----->>>>

// View all users (only for admin)
router.get('/admin/users', (req, res) => {
  if (!req.session.user || req.session.user.is_admin !== 1) {
    return res.render('unauthorized');
  }

  const currentLoginUser = req.session.user.id;
  console.log('Current logged-in user:', currentLoginUser);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err);

      const errorMessage='Database connection error'
      return res.render('error',{errorMessage})
      
    }

    try {
      const query = `
        SELECT 
          u.user_id, u.first_name, u.last_name, u.email, u.user_role_id, 
          r.roles_name AS roleName, 
          c.current_address AS currentAddress, c.permanent_address AS permanentAddress,
          c.phone_number AS phoneNumber, c.emergency_number AS emergencyContact
        FROM users u
        LEFT JOIN roles r ON u.user_role_id = r.role_id
        LEFT JOIN contact_details c ON u.user_id = c.contact_user_id
      `;

      connection.query(query, (err, users) => {
        connection.release();

        if (err) {
          console.error('Error fetching users:', err);
          const errorMessage='Error fetching users'
          return res.render('error',{errorMessage})
          }

        // Render the 'allUserAdmin' page with the list of users
        res.render('allUserAdmin', { users, currentLoginUser });
      });
    } catch (error) {
      console.error('Unexpected error:', error);
      connection.release();

      const errorMessage='Unexpected error occurred'
      return res.render('error',{errorMessage})
      
    }
  });
});



//render edit page for user (only for admin)
router.get('/admin/users/:userId/edit', (req, res) => {
  const userId = req.params.userId;

  try {
    // Check for admin privileges
    if (!req.session.user || req.session.user.is_admin !== 1) {
      return res.render('unauthorized');
    }

    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error connecting to the database:', err);

        const errorMessage='Database connection error'
        return res.render('error',{errorMessage})
        
      }

      // Queries for fetching user, contact, bank, and role details
      const userQuery = `
        SELECT 
          u.user_id, u.first_name, u.last_name, u.email, u.user_role_id, u.pip,
          c.current_address AS currentAddress, c.permanent_address AS permanentAddress,
          c.phone_number AS phoneNumber, c.emergency_number AS emergencyContact
        FROM users u
        LEFT JOIN contact_details c ON u.user_id = c.contact_user_id
        WHERE u.user_id = ?
      `;

      const bankQuery = `
        SELECT 
         *
        FROM bank_details 
        WHERE user_id = ?
      `;

      const rolesQuery = 'SELECT role_id, roles_name FROM roles';

      const permissionsQuery = `
        SELECT 
         *
        FROM permissions 
      `;

      // Execute user query
      connection.query(userQuery, [userId], (err, userResults) => {
        if (err) {
          connection.release();
          console.error('Error fetching user details:', err);

          const errorMessage='Error fetching user details'
          return res.render('error',{errorMessage})
          
        }

        if (userResults.length === 0) {
          connection.release();
          const errorMessage='User not found'
          return res.render('error',{errorMessage})
         
        }

        const user = userResults[0]; // Fetch user details

        // Execute bank query
        connection.query(bankQuery, [userId], (err, bankResults) => {
          if (err) {
            connection.release();
            console.error('Error fetching bank details:', err);

            const errorMessage='Error fetching bank details'
            return res.render('error',{errorMessage})
         
          }

          const bankDetails = bankResults[0] || {}; // Handle if no bank details exist for this user

          // Execute roles query
          connection.query(rolesQuery, (err, rolesResults) => {
            if (err) {
              connection.release();
              console.error('Error fetching roles:', err);
              const errorMessage='Error fetching roles'
              return res.render('error',{errorMessage})
             
            }

            // Execute permissions query
            connection.query(permissionsQuery, [userId], (err, permissionsResults) => {
              connection.release();
              if (err) {
                console.error('Error fetching permissions:', err);

                const errorMessage='Error fetching permissions'
                return res.render('error',{errorMessage})
                
              }

              // Filter granted permissions
              const grantedPermissions = permissionsResults.filter(permission => permission.granted);

              // Pass all data to the template
              res.render('editAllUserAdmin', {
                user,
                bankDetails,
                roles: rolesResults,
                permissions: permissionsResults,
                grantedPermissions: grantedPermissions, // Pass grantedPermissions to template
              });
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

// Save the user details in the database (set by admin)
router.post('/admin/users/:userId/edit', (req, res) => {
  const userId = req.params.userId;
  const { 
    firstName, 
    lastName, 
    email, 
    pip, 
    roleId, 
    currentAddress, 
    permanentAddress, 
    phoneNumber, 
    emergencyContact, 
    userBankName, 
    userIfscCode, 
    userAccountNumber 
  } = req.body;

  try {
    // Check for admin privileges
    if (!req.session.user || req.session.user.is_admin !== 1) {
      return res.render('unauthorized');
    }

    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error connecting to database:', err);
        const errorMessage = 'Database connection error';
        return res.render('error', { errorMessage });
      }

      // Update user details
      const updateUserQuery = `
        UPDATE users 
        SET first_name = ?, last_name = ?, email = ?, pip = ?, user_role_id = ? 
        WHERE user_id = ?
      `;
      connection.query(updateUserQuery, [firstName, lastName, email, pip || null, roleId || null, userId], (err) => {
        if (err) {
          connection.release();
          console.error('Error updating user:', err);
          const errorMessage = 'Error updating user';
          return res.render('error', { errorMessage });
        }

        // Check if contact details already exist for this user
        const checkContactQuery = `SELECT * FROM contact_details WHERE contact_user_id = ?`;
        connection.query(checkContactQuery, [userId], (err, results) => {
          if (err) {
            connection.release();
            console.error('Error checking contact details:', err);
            const errorMessage = 'Error checking contact details';
            return res.render('error', { errorMessage });
          }

          if (results.length > 0) {
            // Contact details exist, update them
            const updateContactQuery = `
              UPDATE contact_details 
              SET current_address = ?, permanent_address = ?, phone_number = ?, emergency_number = ?
              WHERE contact_user_id = ?
            `;
            connection.query(updateContactQuery, [currentAddress, permanentAddress, phoneNumber, emergencyContact, userId], (err) => {
              if (err) {
                connection.release();
                console.error('Error updating contact details:', err);
                const errorMessage = 'Error updating contact details';
                return res.render('error', { errorMessage });
              }

              // Update or insert bank details
              const updateBankQuery = `
                INSERT INTO bank_details (user_id, user_bank_name, user_ifsc_code, user_account_number)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  user_bank_name = VALUES(user_bank_name),
                  user_ifsc_code = VALUES(user_ifsc_code),
                  user_account_number = VALUES(user_account_number)
              `;
              connection.query(updateBankQuery, [userId, userBankName, userIfscCode, userAccountNumber], (err) => {
                connection.release();
                if (err) {
                  console.error('Error updating bank details:', err);
                  const errorMessage = 'Error updating bank details';
                  return res.render('error', { errorMessage });
                }

                // Redirect back to the admin user list
                res.redirect('/user/admin/users');
              });
            });
          } else {
            // No contact details found, insert them
            const insertContactQuery = `
              INSERT INTO contact_details (contact_user_id, current_address, permanent_address, phone_number, emergency_number)
              VALUES (?, ?, ?, ?, ?)
            `;
            connection.query(insertContactQuery, [userId, currentAddress, permanentAddress, phoneNumber, emergencyContact], (err) => {
              if (err) {
                connection.release();
                console.error('Error inserting contact details:', err);
                const errorMessage = 'Error inserting contact details';
                return res.render('error', { errorMessage });
              }

              // Update or insert bank details
              const updateBankQuery = `
                INSERT INTO bank_details (user_id, user_bank_name, user_ifsc_code, user_account_number)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  user_bank_name = VALUES(user_bank_name),
                  user_ifsc_code = VALUES(user_ifsc_code),
                  user_account_number = VALUES(user_account_number)
              `;
              connection.query(updateBankQuery, [userId, userBankName, userIfscCode, userAccountNumber], (err) => {
                connection.release();
                if (err) {
                  console.error('Error updating bank details:', err);
                  const errorMessage = 'Error updating bank details';
                  return res.render('error', { errorMessage });
                }

                // Redirect back to the admin user list
                res.redirect('/user/admin/users');
              });
            });
          }
        });
      });
    });
  } catch (error) {
    console.error('Unexpected error occurred:', error);
    const errorMessage = 'Internal server error';
    return res.render('error', { errorMessage });
  }
});


// Permission grant for user (allow user to give certain permission) 
router.post('/admin/users/:userId/permissions/grant', (req, res) => {
  const userId = req.params.userId;
  const permissionName = req.body.permission_name; // Permission name from the form

  try {
    // Check if permission_name is provided
    if (!permissionName) {

      const errorMessage='No permission name provided'
      return res.render('error',{errorMessage})
    
    }

    // Check for admin privileges
    if (!req.session.user || req.session.user.is_admin !== 1) {
      return res.render('unauthorized');
    }

    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error connecting to the database:', err);

        const errorMessage='Database connection error'
      return res.render('error',{errorMessage})
       
      }

      // Check if the permission is already granted to the user
      const checkPermissionQuery = `
        SELECT * FROM permissions 
        WHERE user_id = ? AND permission_name = ?
      `;
      
      connection.query(checkPermissionQuery, [userId, permissionName], (err, results) => {
        if (err) {
          connection.release();
          console.error('Error checking permission:', err);

          const errorMessage='Error checking permission'
          return res.render('error',{errorMessage})
         
        }

        if (results.length > 0) {
          // Permission already granted
          connection.release();

          const errorMessage='Permission already granted'
          return res.render('error',{errorMessage})
         
        }
        
        // If not already granted, insert the new permission
        const insertPermissionQuery = `
          INSERT INTO permissions (user_id, permission_name, granted)
          VALUES (?, ?, 1)  -- granted is set to 1
        `;

        connection.query(insertPermissionQuery, [userId, permissionName], (err, result) => {
          connection.release();

          if (err) {
            console.error('Error granting permission:', err);

            const errorMessage='Error granting permission'
            return res.render('error',{errorMessage})
            
          }

          // Redirect back to the user edit page
          res.redirect(`/user/admin/users/${userId}/edit`);
        });
      });
    });
  } catch (error) {
    console.error('Unexpected error occurred:', error);

    const errorMessage='Internal server error'
    return res.render('error',{errorMessage})
    
  }
});

// Route to handle deleting a permission from a user
router.post('/admin/users/:userId/permissions/:permissionName/delete', (req, res) => {
  const userId = req.params.userId;
  const permissionName = req.params.permissionName;

  try {
    // Check for admin privileges
    if (!req.session.user || req.session.user.is_admin !== 1) {
      return res.render('unauthorized');
    }

    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error connecting to the database:', err);

        const errorMessage='Database connection error'
        return res.render('error',{errorMessage})
       
      }

      // Delete the permission from the permissions table
      const deleteQuery = `
        DELETE FROM permissions
        WHERE user_id = ? AND permission_name = ?
      `;
      
      connection.query(deleteQuery, [userId, permissionName], (err, result) => {
        connection.release();
        
        if (err) {
          console.error('Error deleting permission:', err);

          const errorMessage='Error deleting permission'
        return res.render('error',{errorMessage})
          
        }

        // Redirect back to the user edit page
        res.redirect(`/user/admin/users/${userId}/edit`);
      });
    });
  } catch (error) {
    console.error('Unexpected error occurred:', error);

    const errorMessage='Internal server error'
    return res.render('error',{errorMessage})
   
  }
});


module.exports = router;
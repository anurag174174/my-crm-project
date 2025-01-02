const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

const pool = require('../database/connection');

router.get('/register', (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      res.status(500).send('Error connecting to database');
      return;
    }

    connection.query('SELECT * FROM roles', (err, results) => {
      if (err) {
        console.error('Error fetching roles:', err);
        connection.release();
        res.status(500).send('Error fetching roles');
        return;
      }

      connection.release();
      res.render('userRegistration', { roles: results });
    });
  });
});

// registering users
router.post('/register', (req, res) => {
  var firstName = req.body.firstName;
  var lastName = req.body.lastName;
  var email = req.body.email;
  //var role = req.body.role;
  var password = req.body.password;
  var roleId = req.body.roleId

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
        var sql = "INSERT INTO users(first_name, last_name, email, user_role_id, password_hash) VALUES(?,?,?,?,?)";
        connection.query(sql, [firstName, lastName, email, roleId, hash], (error, results) => {
          connection.release(); // Release the connection back to the pool

          if (error) {
            console.error('Error inserting data:', error);
            res.status(500).send('Error inserting data');
            return;
          }
          const userId = results.insertId;

          req.session.user = {
            id: userId,
            firstName: firstName,
            lastName: lastName,
            email: email,
            //role: role,

          };

          // console.log('User ID after registration:', userId);
          req.session.save((err) => {
            if (err) {
              console.error('Error saving session:', err);
              res.status(500).send('Error saving session');
              return;
            }
            res.redirect('/users/login');
          });


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
          return;
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
            user_role_id: user.user_role_id
          };

          req.session.save((err) => {
            if (err) {
              console.error('Error saving session:', err);
              res.status(500).send('Error saving session');
              return;
            }

            console.log('Session user after login:', req.session.user);
            res.redirect(`/user/${req.session.user.id}/dashboard`);
          });
        } else {
          connection.release();
          res.status(401).send('Invalid email or password');
        }
      });
    });
  });
});



//view assigned user detail
router.get('/assign/:userId', (req, res) => {
  const userId = req.params.userId;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      res.status(500).send('Error connecting to database');
      return;
    }

    connection.query(`
        SELECT 
          u.*, 
          r.roles_name as roleName 
        FROM 
          users u
        JOIN 
          roles r ON u.user_role_id = r.role_id 
        WHERE u.user_id = ?`,
      [userId],
      (err, userResults) => {
        if (err) {
          console.error('Error fetching user:', err);
          connection.release();
          res.status(500).send('Error fetching user data');
          return;
        }

        if (userResults.length === 0) {
          connection.release();
          return res.status(404).send('User not found');
        }
        const isCurrentUser = req.session.user.id === userId;

        const user = userResults[0];
        connection.release();
        res.render('userDetail', { user, isCurrentUser });
      });
  });
});


//view user details

router.get('/:userId', (req, res) => {
  const userId = req.params.userId;

  const userIdFromUrl = parseInt(req.params.userId, 10);

  if (!req.session.user) {
    return res.render('unauthorized')
  }

  if (req.session.user.id !== userIdFromUrl) {
    return res.render('unauthorized')
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      res.status(500).send('Error connecting to database');
      return;
    }

    connection.query(`
        SELECT 
    u.*, 
    r.roles_name AS roleName, 
    cd.user_current_address, 
    cd.user_permanent_address, 
    cd.user_phone_number, 
    cd.user_emergency_number
FROM 
    users u
JOIN 
    roles r ON u.user_role_id = r.role_id
LEFT JOIN 
    contact_details cd ON u.user_id = cd.contact_user_id
WHERE 
    u.user_id = ?
`,
      [userId],
      (error, results) => {
        connection.release();

        if (error) {
          console.error('Error fetching user:', error);
          res.status(500).send('Error fetching user data');
          return;
        }

        if (results.length === 0) {
          return res.status(404).send('User not found');
        }
        const isCurrentUser = req.session.user.id === userId;
        res.render('userDetail', { user: results[0], isCurrentUser });
      });
  });
});


//editing user
router.get('/:userId/edit', (req, res) => {
  const userId = req.params.userId;


  if (!req.session.user) {
    return res.render('unauthorized');
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      res.status(500).send('Error connecting to database');
      return;
    }

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
      [userId],
      (err, userResults) => {
        if (err) {
          console.error('Error fetching user:', err);
          connection.release();
          res.status(500).send('Error fetching user data');
          return;
        }

        console.log(userResults[0]);

        if (userResults.length === 0) {
          connection.release();
          return res.status(404).send('User not found');
        }

        // Fetch all roles for the dropdown
        connection.query('SELECT * FROM roles', (err, rolesResults) => {
          if (err) {
            console.error('Error fetching roles:', err);
            connection.release();
            res.status(500).send('Error fetching roles');
            return;
          }

          connection.release();
          // Pass the user data and roles to the view
          res.render('editUser', { user: userResults[0], roles: rolesResults });
        });
      });
  });
});

router.post('/:userId/edit', (req, res) => {
  const userId = req.params.userId;
  const { firstName, lastName, email, roleId, permanentAddress, currentAddress, phoneNumber, emergencyContact } = req.body;

  console.log(req.body); // Debugging the request body

  // Check if user is authenticated
  if (!req.session.user) {
    return res.render('unauthorized');
  }

  // Get the role of the logged-in user
  const isAdmin = req.session.user.is_admin; // If is_admin is 1, the user is an admin

  // Establish DB connection
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      res.status(500).send('Error connecting to database');
      return;
    }

    // If the user is an admin, update the user details and role, otherwise only update user details
    if (isAdmin) {
      // Update user details along with the role for admins
      connection.query(
        'UPDATE users SET first_name = ?, last_name = ?, email = ?, user_role_id = ? WHERE user_id = ?',
        [firstName, lastName, email, roleId, userId],
        (err, result) => {
          if (err) {
            connection.release();
            console.error('Error updating user:', err);
            return res.status(500).send('Error updating user data');
          }

          if (result.affectedRows === 0) {
            connection.release();
            return res.status(404).send('User not found');
          }

          // Now update the contact details for the admin (if exists)
          const checkContactQuery = 'SELECT * FROM contact_details WHERE contact_user_id = ?';
          connection.query(checkContactQuery, [userId], (err, contactResult) => {
            if (err) {
              connection.release();
              console.error('Error checking contact details:', err);
              return res.status(500).send('Error checking contact details');
            }

            let contactQuery;
            let contactParams;

            if (contactResult.length > 0) {
              // If contact exists, update it
              contactQuery = `
                UPDATE contact_details 
                SET user_current_address = ?, user_permanent_address = ?, user_phone_number = ?, user_emergency_number = ?
                WHERE contact_user_id = ?
              `;
              contactParams = [currentAddress, permanentAddress, phoneNumber, emergencyContact, userId];
            } else {
              // If contact doesn't exist, insert it
              contactQuery = `
                INSERT INTO contact_details (contact_user_id, user_current_address, user_permanent_address, user_phone_number, user_emergency_number)
                VALUES (?, ?, ?, ?, ?)
              `;
              contactParams = [userId, currentAddress, permanentAddress, phoneNumber, emergencyContact];
            }

            // Insert or update contact details
            connection.query(contactQuery, contactParams, (err, contactResult) => {
              connection.release();
              if (err) {
                console.error('Error updating/adding contact details:', err);
                return res.status(500).send('Error updating/adding contact details');
              }

              // Redirect after successfully updating both user and contact details
              res.redirect(`/user/${userId}`);
            });
          });
        }
      );
    } else {
      // If the user is not an admin, only update user details (no role update)
      connection.query(
        'UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE user_id = ?',
        [firstName, lastName, email, userId],
        (err, result) => {
          connection.release();
          if (err) {
            console.error('Error updating user:', err);
            return res.status(500).send('Error updating user data');
          }

          if (result.affectedRows === 0) {
            return res.status(404).send('User not found');
          }

          // Redirect after successfully updating user details
          res.redirect(`/user/${userId}`);
        }
      );
    }
  });
});

// In your routes/users.js file

router.get('/creator/:creatorId', (req, res) => {
  const creatorId = req.params.creatorId;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      res.status(500).send('Error connecting to database');
      return;
    }

    connection.query(`
      SELECT 
    u.*, 
    r.roles_name AS roleName, 
    cd.user_current_address, 
    cd.user_permanent_address, 
    cd.user_phone_number, 
    cd.user_emergency_number
FROM 
    users u
JOIN 
    roles r ON u.user_role_id = r.role_id
LEFT JOIN 
    contact_details cd ON u.user_id = cd.contact_user_id
WHERE 
    u.user_id = ?
`,
      [creatorId],
      (error, results) => {
        connection.release();

        if (error) {
          console.error('Error fetching user:', error);
          res.status(500).send('Error fetching user data');
          return;
        }

        if (results.length === 0) {
          return res.status(404).send('User not found');
        }

        res.render('createdByUserDetail', { user: results[0] });
      });
  });
});


//admin panel 
router.get('/admin/users', (req, res) => {
  if (!req.session.user || req.session.user.is_admin !== 1) {
    return res.render('unauthorized');
  }
  currentLoginUser=req.session.user.id; // taking the login users
  console.log(currentLoginUser)
  
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err);
      res.status(500).send('Database connection error');
      return;
    }

    const query = `
      SELECT 
        u.user_id, u.first_name, u.last_name, u.email, u.user_role_id, 
        r.roles_name AS roleName, 
        c.user_current_address AS currentAddress, c.user_permanent_address AS permanentAddress,
        c.user_phone_number AS phoneNumber, c.user_emergency_number AS emergencyContact
      FROM users u
      LEFT JOIN roles r ON u.user_role_id = r.role_id
      LEFT JOIN contact_details c ON u.user_id = c.contact_user_id
    `;

    connection.query(query, (err, users) => {
      connection.release();
      if (err) {
        console.error('Error fetching users:', err);
        res.status(500).send('Error fetching users');
        return;
      }

      res.render('allUserAdmin', { users ,currentLoginUser });
    });
  });
});



router.get('/admin/users/:userId/edit', (req, res) => {
  const userId = req.params.userId;

  // Check for admin privileges
  if (!req.session.user || req.session.user.is_admin !== 1) {
    return res.render('unauthorized');
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to the database:', err);
      return res.status(500).send('Database connection error');
    }

    // Queries for fetching user, contact, bank, and role details
    const userQuery = `
      SELECT 
        u.user_id, u.first_name, u.last_name, u.email, u.user_role_id, u.pip,
        c.user_current_address AS currentAddress, c.user_permanent_address AS permanentAddress,
        c.user_phone_number AS phoneNumber, c.user_emergency_number AS emergencyContact
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
        return res.status(500).send('Error fetching user details');
      }

      if (userResults.length === 0) {
        connection.release();
        return res.status(404).send('User not found');
      }

      const user = userResults[0]; // Fetch user details

      // Execute bank query
      connection.query(bankQuery, [userId], (err, bankResults) => {
        if (err) {
          connection.release();
          console.error('Error fetching bank details:', err);
          return res.status(500).send('Error fetching bank details');
        }

        const bankDetails = bankResults[0] || {}; // Handle if no bank details exist for this user

        // Execute roles query
        connection.query(rolesQuery, (err, rolesResults) => {
          if (err) {
            connection.release();
            console.error('Error fetching roles:', err);
            return res.status(500).send('Error fetching roles');
          }

          // Execute permissions query
          connection.query(permissionsQuery, [userId], (err, permissionsResults) => {
            connection.release();
            if (err) {
              console.error('Error fetching permissions:', err);
              return res.status(500).send('Error fetching permissions');
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
});


router.post('/admin/users/:userId/permissions/grant', (req, res) => {
  const userId = req.params.userId;
  const permissionName = req.body.permission_name; // Permission name from the form

  // Check if permission_name is provided
  if (!permissionName) {
    return res.status(400).send('No permission name provided');
  }

  // Check for admin privileges
  if (!req.session.user || req.session.user.is_admin !== 1) {
    return res.render('unauthorized');
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to the database:', err);
      return res.status(500).send('Database connection error');
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
        return res.status(500).send('Error checking permission');
      }

      if (results.length > 0) {
        // Permission already granted
        connection.release();
        return res.status(400).send('This permission has already been granted to the user.');
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
          return res.status(500).send('Error granting permission');
        }

        // Redirect back to the user edit page
        res.redirect(`/user/admin/users/${userId}/edit`);
      });
    });
  });
});


// Route to handle deleting a permission from a user
router.post('/admin/users/:userId/permissions/:permissionName/delete', (req, res) => {
  const userId = req.params.userId;
  const permissionName = req.params.permissionName;

  // Check for admin privileges
  if (!req.session.user || req.session.user.is_admin !== 1) {
    return res.render('unauthorized');
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to the database:', err);
      return res.status(500).send('Database connection error');
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
        return res.status(500).send('Error deleting permission');
      }

      // Redirect back to the user edit page
      res.redirect(`/user/admin/users/${userId}/edit`);
    });
  });
});


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

  if (!req.session.user || req.session.user.is_admin !== 1) {
    return res.render('unauthorized');
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err);
      res.status(500).send('Database connection error');
      return;
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
        res.status(500).send('Error updating user');
        return;
      }

      // Update or insert contact details
      const updateContactQuery = `
        INSERT INTO contact_details (contact_user_id, user_current_address, user_permanent_address, user_phone_number, user_emergency_number)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          user_current_address = VALUES(user_current_address),
          user_permanent_address = VALUES(user_permanent_address),
          user_phone_number = VALUES(user_phone_number),
          user_emergency_number = VALUES(user_emergency_number)
      `;
      connection.query(updateContactQuery, [userId, currentAddress, permanentAddress, phoneNumber, emergencyContact], (err) => {
        if (err) {
          connection.release();
          console.error('Error updating contact details:', err);
          res.status(500).send('Error updating contact details');
          return;
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
            res.status(500).send('Error updating bank details');
            return;
          }
          
          // Redirect back to the admin user list
          res.redirect('/user/admin/users');
        });
      });
    });
  });
});




module.exports = router;
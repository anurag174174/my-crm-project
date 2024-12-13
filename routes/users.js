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
    var roleId=req.body.roleId

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

                    // console.log('Data inserted successfully');
                    // res.redirect('/users/login');
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
            console.log(user.user_id)

            bcrypt.compare(password, user.password_hash, (err, isMatch) => {
                if (err) {
                    console.error('Error comparing passwords:', err);
                    res.status(500).send('Error comparing passwords');
                    return;
                }

                if (isMatch) {
                    req.session.user = {
                        id: user.user_id,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        email: user.email,
                        roleId: user.user_role_id,
                        is_admin: user.is_admin
                    };

                    req.session.save((err) => {
                        if (err) {
                            console.error('Error saving session:', err);
                            res.status(500).send('Error saving session');
                            return;
                        }

                        console.log('User ID after login:', req.session.user.id);
                        res.redirect(`/user/${req.session.user.id}/dashboard`);
                        // res.render('dashboard', { user: req.session.user });
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
          res.render('userDetail', { user ,isCurrentUser}); 
        });
      });
});
  

//view user 

router.get('/:userId', (req, res) => {
    const userId = req.params.userId;
  
    const userIdFromUrl = parseInt(req.params.userId, 10); 
  
    if (!req.session.user) {
      return res.status(401).send('Unauthorized');
    }
  
    if (req.session.user.id !== userIdFromUrl) {
      return res.status(401).send('Unauthorized'); 
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
          r.roles_name as roleName 
        FROM 
          users u
        JOIN 
          roles r ON u.user_role_id = r.role_id 
        WHERE u.user_id = ?`, 
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

// router.get('/:userId', (req, res) => {
//     const userId = req.params.userId;
 
//     const userIdFromUrl = parseInt(req.params.userId, 10); // Extract and parse the userId from the URL

//     // Check if user is logged in
//     if (!req.session.user) {
//         return res.status(401).send('Unauthorized');
//     }

//     // Check if the logged-in user's ID matches the userId in the URL
//     if (req.session.user.id !== userIdFromUrl) {
//         return res.status(401).send('Unauthorized'); // Prevent access to other users' details
//     }
//     pool.getConnection((err, connection) => {
//         if (err) {
//             console.error('Error getting connection from pool:', err);
//             res.status(500).send('Error connecting to database');
//             return;
//         }

//         connection.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
//             connection.release();

//             if (error) {
//                 console.error('Error fetching user:', error);
//                 res.status(500).send('Error fetching user data');
//                 return;
//             }

//             if (results.length === 0) {
//                 return res.status(404).send('User not found');
//             }

//             res.render('userDetail', { user: results[0] });
//         });
//     });
// });


//editing user

router.get('/:userId/edit', (req, res) => {
    const userId = req.params.userId;
    const userIdFromUrl = parseInt(req.params.userId, 10); 
  
    if (!req.session.user) {
      return res.status(401).send('Unauthorized , session expired');
    }
  
    if (req.session.user.id !== userIdFromUrl) {
      return res.status(401).send('Unauthorized , you are not authorized'); 
    }
  
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting connection from pool:', err);
        res.status(500).send('Error connecting to database');
        return;
      }
  
      // Fetch user details with role name
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
  
          // Fetch all roles for the dropdown
          connection.query('SELECT * FROM roles', (err, rolesResults) => {
            if (err) {
              console.error('Error fetching roles:', err);
              connection.release();
              res.status(500).send('Error fetching roles');
              return;
            }
  
            connection.release();
            res.render('editUser', { user: userResults[0], roles: rolesResults });
          });
        });
      });
    });
  
  

// router.get('/:userId/edit', (req, res) => {
//     const userId = req.params.userId;
//     const userIdFromUrl = parseInt(req.params.userId, 10); // Extract and parse the userId from the URL

//     // Check if user is logged in
//     if (!req.session.user) {
//         return res.status(401).send('Unauthorized');
//     }

//     // Check if the logged-in user's ID matches the userId in the URL
//     if (req.session.user.id !== userIdFromUrl) {
//         return res.status(401).send('Unauthorized'); // Prevent access to other users' details
//     }
//     pool.getConnection((err, connection) => {
//         if (err) {
//             console.error('Error getting connection from pool:', err);
//             res.status(500).send('Error connecting to database');
//             return;
//         }

//         connection.query('SELECT * FROM users WHERE user_id = ?', [userId], (err, results) => {
//             connection.release();

//             if (err) {
//                 console.error('Error fetching user:', err);
//                 res.status(500).send('Error fetching user data');
//                 return;
//             }

//             if (results.length === 0) {
//                 return res.status(404).send('User not found');
//             }

//             res.render('editUser', { user: results[0] });
//         });
//     });
// });



router.post('/:userId/edit', (req, res) => {
    const userId = req.params.userId;
    const { firstName, lastName, email, roleId } = req.body; 
  
    if (!req.session.user) {
      return res.status(401).send('Unauthorized, session out');
    }
  
    if (req.session.user.id !== parseInt(userId)) {
      return res.status(401).send('Unauthorized , you re not the user'); 
    }
  
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting connection from pool:', err);
        res.status(500).send('Error connecting to database');
        return;
      }
  
      connection.query('UPDATE users SET first_name = ?, last_name = ?, email = ?, user_role_id = ? WHERE user_id = ?', 
                       [firstName, lastName, email, roleId, userId], 
                       (err, result) => {
        connection.release();
  
        if (err) {
          console.error('Error updating user:', err);
          res.status(500).send('Error updating user data');
          return;
        }
  
        if (result.affectedRows === 0) {
          return res.status(404).send('User not found');
        }
  
        res.redirect(`/user/${userId}`);
      });
    });
  });

// router.post('/:userId/edit', (req, res) => {
//     const userId = req.params.userId;
//     const { firstName, lastName, email, role } = req.body;
//     if (!req.session.user) {
//         return res.status(401).send('Unauthorized');
//     }

//     pool.getConnection((err, connection) => {
//         if (err) {
//             console.error('Error getting connection from pool:', err);
//             res.status(500).send('Error connecting to database');
//             return;
//         }

//         connection.query('UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ? WHERE user_id = ?', [firstName, lastName, email, role, userId],
//             (err, result) => {
//                 connection.release();

//                 if (err) {
//                     console.error('Error updating user:', err);
//                     res.status(500).send('Error updating user data');
//                     return;
//                 }

//                 if (result.affectedRows === 0) {
//                     return res.status(404).send('User not found');
//                 }

//                 res.redirect(`/user/${userId}`);
//             });
//     });
// });


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
          r.roles_name as roleName 
        FROM 
          users u
        JOIN 
          roles r ON u.user_role_id = r.role_id 
        WHERE u.user_id = ?`, 
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
  
// router.get('/creator/:creatorId', (req, res) => {
//     const creatorId = req.params.creatorId; 
  
//     pool.getConnection((err, connection) => {
//       if (err) {
//         console.error('Error getting connection from pool:', err);
//         res.status(500).send('Error connecting to database');
//         return;
//       }
  
//       connection.query('SELECT * FROM users WHERE user_id = ?', [creatorId], (error, results) => {
//         connection.release();
//         //console.log(results[0])
  
//         if (error) {
//           console.error('Error fetching user:', error);
//           res.status(500).send('Error fetching user data');
//           return;
//         }
  
//         if (results.length === 0) {
//           return res.status(404).send('User not found');
//         }
  
//         res.render('createdByUserDetail', { user: results[0] }); 
//       });
//     });
//   });



module.exports = router;

// try {
//     const userId = req.params.userId;

//     const [results] = await pool.query('SELECT * FROM users WHERE user_id = ?', [userId]);

//     if (results.length === 0) {
//         return res.status(404).send('User not found');
//     }

//     const user = results[0];
//     res.render('userProfile', { user: user });
// } catch (error) {
//     console.error('Error fetching user:', error);
//     res.status(500).send('Error fetching user data');
// }


// })



// router.post('/login', (req, res) => {
//     const { email, password } = req.body;

//     pool.getConnection((err, connection) => {
//         if (err) {
//             console.error('Error getting connection from pool:', err);
//             res.status(500).send('Error connecting to database');
//             return;
//         }

//         connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
//             if (err) {
//                 console.error('Error fetching user:', err);
//                 res.status(500).send('Error fetching user');
//                 connection.release();
//                 return;
//             }

//             if (results.length === 0) {
//                 connection.release();
//                 return res.status(401).send('Invalid email or password');
//             }

//             const user = results[0];

//             bcrypt.compare(password, user.password_hash, (err, isMatch) => {
//                 if (err) {
//                     console.error('Error comparing passwords:', err);
//                     res.status(500).send('Error comparing passwords');
//                 }

//                 if (isMatch) {

//                     req.session.user = {
//                         id: user.id,
//                         firstName: user.first_name,
//                         lastName: user.last_name,
//                         email: user.email,
//                         role: user.role,
//                     }
//                     console.log('User ID after login:', req.session.user.id);
//                     connection.release();
//                     res.render('dashboard', { user: req.session.user })
//                 } else {
//                     connection.release();
//                     res.status(401).send('Invalid email or password');
//                 }
//             });
//         });
//     });
// });
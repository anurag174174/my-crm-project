
const express = require('express');
const router = express.Router();
const pool = require('../database/connection');


router.get('/:userId/dashboard', (req, res) => {
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
  
      connection.query(`
        SELECT 
          l.*, 
          u.first_name, 
          u.last_name, 
          r.roles_name as roleName 
        FROM 
          leads l
        LEFT JOIN 
          users u ON l.lead_owner_id = u.user_id
        LEFT JOIN 
          roles r ON u.user_role_id = r.role_id 
        WHERE 
          l.lead_owner_id = ?`, 
        [userId], 
        (err, leadsResults) => {
          if (err) {
            console.error('Error fetching leads:', err);
            connection.release();
            res.status(500).send('Error fetching leads');
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
                console.error('Error retrieving user details:', err);
                connection.release();
                res.status(500).send('Error retrieving user details');
                return;
              }
  
              if (userResults.length === 0) {
                connection.release();
                return res.status(404).send('User not found'); 
              }
  
              const user = userResults[0]; 
  
              connection.release();
              res.render('dashboard', { user: user, leads: leadsResults });
            });
        });
      });
    });
  

// router.get('/:userId/dashboard', (req, res) => {
//     if (!req.session.user) {
//         return res.status(401).send('Unauthorized');
//     }

//     const userId = req.session.user.id;
//     console.log(userId);

//     pool.getConnection((err, connection) => {
//         if (err) {
//             console.error('Error getting connection from pool:', err);
//             res.status(500).send('Error connecting to database');
//             return;
//         }

//         connection.query('SELECT * FROM leads WHERE lead_owner_id = ?', [userId], (err, results) => {
//             connection.release();

//             if (err) {
//                 console.error('Error fetching leads:', err);
//                 res.status(500).send('Error fetching leads');
//                 return;
//             }

//             res.render('dashboard', { user: req.session.user, leads: results });
//         });
//     });
// });

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../database/connection');

router.get('/:userId/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.render('unauthorized');
  }

  const userId = req.session.user.id;
  const userRoleId = req.session.user.user_role_id; // Fetch the role ID from the session

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      res.status(500).send('Error connecting to database');
      return;
    }

    // Fetch user details along with role
    connection.query(
      `
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

        // Fetch the last created lead for all users with aliases
        connection.query(
          `
            SELECT 
              l.lead_id as leadId, 
              l.first_name as leadFirstName, 
              l.last_name as leadLastName, 
              l.email as leadEmail, 
              l.phone_number as leadPhoneNumber, 
              l.company_name as leadCompanyName, 
              l.lead_score as leadScore, 
              l.created_at as leadCreatedAt 
            FROM 
              leads l 
            WHERE 
              l.lead_owner_id = ? 
            ORDER BY l.created_at DESC
            LIMIT 1`,
          [userId],
          (err, lastLeadResults) => {
            if (err) {
              console.error('Error fetching last lead:', err);
              connection.release();
              res.status(500).send('Error fetching last lead');
              return;
            }

            connection.release();
            // Pass both userRoleId and lastLead to the template
            res.render('dashboard', { user: user, lastLead: lastLeadResults[0] || null});
          }
        );
      }
    );
  });
});




module.exports = router;
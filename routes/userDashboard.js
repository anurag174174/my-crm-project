
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

        // Fetch the last created lead for the user
        connection.query(
          `SELECT 
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

            // Fetch all leads with 'won' status for the user
            connection.query(
              `SELECT 
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
                JOIN 
                  lead_statuses ls ON l.lead_status_id = ls.lead_status_id
                WHERE 
                  ls.status_name = 'won' AND 
                  l.lead_owner_id = ?
                ORDER BY l.updated_at DESC  LIMIT 1 `,
              [userId],
              (err, wonLeadsResults) => {
                if (err) {
                  console.error('Error fetching won leads:', err);
                  connection.release();
                  res.status(500).send('Error fetching won leads');
                  return;
                }

                connection.release();
                
                // Pass user, lastLead, and wonLeads to the template
                res.render('dashboard', { 
                  user: user, 
                  lastLead: lastLeadResults[0] || null, 
                  wonLeads: wonLeadsResults[0] 
                });
              }
            );
          }
        );
      }
    );
  });
});

module.exports = router;
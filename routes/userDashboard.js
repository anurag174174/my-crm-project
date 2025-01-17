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
      const errorMessage = 'Error connecting to database.';
      return res.render('error', { errorMessage });
    }

    try {
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
            const errorMessage = 'Error retrieving user details.';
            return res.render('error', { errorMessage });
          }

          if (userResults.length === 0) {
            connection.release();
            const errorMessage = 'User not found.';
            return res.render('error', { errorMessage });
          }

          const user = userResults[0];

          try {
            // Fetch the last created lead for the user
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
                  const errorMessage = 'Error fetching last lead.';
                  return res.render('error', { errorMessage });
                }

                try {
                  // Fetch all leads with 'won' status for the user
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
                      JOIN 
                        lead_statuses ls ON l.lead_status_id = ls.lead_status_id
                      WHERE 
                        ls.status_name = 'won' AND 
                        l.lead_owner_id = ?
                      ORDER BY l.updated_at DESC LIMIT 1`,
                    [userId],
                    (err, wonLeadsResults) => {
                      if (err) {
                        console.error('Error fetching won leads:', err);
                        connection.release();
                        const errorMessage = 'Error fetching won leads.';
                        return res.render('error', { errorMessage });
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
                } catch (err) {
                  console.error('Error in fetching won leads:', err);
                  connection.release();
                  const errorMessage = 'Error fetching won leads.';
                  return res.render('error', { errorMessage });
                }
              }
            );
          } catch (err) {
            console.error('Error in fetching last lead:', err);
            connection.release();
            const errorMessage = 'Error fetching last lead.';
            return res.render('error', { errorMessage });
          }
        }
      );
    } catch (err) {
      console.error('Error in retrieving user details:', err);
      connection.release();
      const errorMessage = 'Error retrieving user details.';
      return res.render('error', { errorMessage });
    }
  });
});

module.exports = router;

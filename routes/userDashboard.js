// const express = require('express');
// const router = express.Router();
// const pool = require('../database/connection');

// router.get('/:userId/dashboard', async(req, res) => {
//     try {
//         if (!req.session.user) {
//             return res.status(401).send('Unauthorized');
//         }

//         const userId = req.params.userId;

//         // Check if the requested userId matches the logged-in user's ID
//         // if (userId !== req.session.user.id) {
//         //     return res.status(403).send('Forbidden');
//         // }

//         // Fetch user data and leads
//         const [
//             [user]
//         ] = await pool.query('SELECT * FROM users WHERE user_id = ?', [userId]);
//         const [leads] = await pool.query('SELECT * FROM leads WHERE lead_owner_id = ?', [userId]);

//         res.render('dashboard', { user: user, leads: leads });

//     } catch (error) {
//         console.error('Error accessing dashboard:', error);
//         res.status(500).send('Error accessing dashboard');
//     }
// });

// module.exports = router; // // userDashboard.js
const express = require('express');
const router = express.Router();
const pool = require('../database/connection');

router.get('/:userId/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized');
    }

    const userId = req.session.user.id;
    console.log(userId);

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            res.status(500).send('Error connecting to database');
            return;
        }

        connection.query('SELECT * FROM leads WHERE lead_owner_id = ?', [userId], (err, results) => {
            connection.release();

            if (err) {
                console.error('Error fetching leads:', err);
                res.status(500).send('Error fetching leads');
                return;
            }

            res.render('dashboard', { user: req.session.user, leads: results });
        });
    });
});

module.exports = router;
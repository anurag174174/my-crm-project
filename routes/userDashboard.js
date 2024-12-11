
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
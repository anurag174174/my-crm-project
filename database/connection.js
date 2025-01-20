const mysql = require('mysql2')


const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'crm',
    connectionLimit: 100

})

module.exports = pool;
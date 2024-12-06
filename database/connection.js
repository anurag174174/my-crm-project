const mysql = require('mysql')


const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'crm',
    connectionLimit: 100

})


module.exports = pool;
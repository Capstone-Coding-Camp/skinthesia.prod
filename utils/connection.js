// Konfigurasi database
const dbConfig = {
    host: process.env.DB_HOST || 'database-2.cts6c2eoukli.ap-southeast-1.rds.amazonaws.com',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'skinthesia123',
    database: process.env.DB_NAME || 'skinthesia', // Ganti dengan nama database Anda
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

export default dbConfig;
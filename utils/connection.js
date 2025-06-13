// Konfigurasi database
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'skinthesia', // Ganti dengan nama database Anda
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

export default dbConfig;
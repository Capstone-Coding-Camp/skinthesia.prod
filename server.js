// server.js
import Hapi from '@hapi/hapi';
import Inert from '@hapi/inert';
import Vision from '@hapi/vision';
import HapiSwagger from 'hapi-swagger';
import Jwt from '@hapi/jwt'; // Plugin JWT Hapi
import dbConfig from './utils/connection.js'; // Import dbConfig
import mysql from 'mysql2/promise'; // Import mysql2

import routes from './routes.js';
import dotenv from 'dotenv';
dotenv.config();

const init = async () => {
    const server = Hapi.server({
        port: process.env.PORT || 3000,
        host: 'localhost',
        routes: {
            cors: {
                origin: ['*'], // Ganti dengan URL frontend Anda
                credentials: true, // Izinkan pengiriman cookie
                headers: ['Authorization', 'Content-Type', 'Accept'],
                exposedHeaders: ['Content-Disposition'], // Jika Anda mengirim header kustom dari backend
            },
            payload: {
                parse: true,
                allow: 'application/json', // tambahkan ini
                output: 'data',
                // maxBytes: 10 * 1024 * 1024, // Maksimal payload global 10MB (termasuk file)
                // output: 'stream', // Default untuk payload yang lebih besar
                // parse: true,
                // multipart: true, // Izinkan multipart/form-data secara global
            }
        },
        state: {
            strictHeader: false,
        }
    });

    // Konfigurasi Swagger
    const swaggerOptions = {
        info: {
            title: 'API Documentation',
            version: '1.0.0',
            description: 'Dokumentasi API dengan Hapi-Swagger',
        },
        grouping: 'tags',
        tags: [
            { name: 'users', description: 'Endpoints terkait pengguna' },
            { name: 'auth', description: 'Endpoints Autentikasi' },
            { name: 'testimonials', description: 'Endpoints terkait Testimoni' },
            { name: 'files', description: 'Endpoints untuk file statis dan upload' },
            { name: 'recommendation', description: 'Endpoints Rekomendasi Produk' } 
        ],
        documentationPage: true,
        jsonEditor: false,
        securityDefinitions: {
            'jwt': {
                type: 'apiKey',
                name: 'Authorization',
                in: 'header',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Masukkan Access Token Anda di sini (contoh: Bearer <token>)'
            }
        },
        security: [{ 'jwt': [] }] // Default security untuk semua endpoint di Swagger UI
    };

    // Register plugins
    await server.register([
        Jwt,
        Inert, // Diperlukan untuk melayani file statis
        Vision, // Diperlukan oleh Hapi Swagger
        {
            plugin: HapiSwagger,
            options: swaggerOptions
        }
    ]);

    // Strategi Otentikasi JWT
    server.auth.strategy('jwt', 'jwt', {
        keys: process.env.JWT_SECRET || 'm4Rt4B4kMan15SaNg4tEn4K123', // Gunakan secret key dari .env
        verify: {
            aud: false,
            iss: false,
            sub: false,
            nbf: true,
            exp: true,
            maxAgeSec: 14400, // contoh: 4 jam
            timeSkewSec: 15
        },
        validate: async (artifacts, request, h) => {
            // Validasi di sini, misal cek user di DB
            let connection;
            try {
                connection = await mysql.createPool(dbConfig).getConnection(); // Gunakan pool yang sama
                const [users] = await connection.execute(
                    'SELECT public_id, email FROM users WHERE public_id = ?',
                    [artifacts.decoded.payload.publicId]
                );

                if (users.length === 0) {
                    return { isValid: false };
                }

                return {
                    isValid: true,
                    credentials: {
                        publicId: users[0].public_id, // Penting: publicId user dari DB
                        email: users[0].email,
                        // ... tambahkan data user lain yang relevan
                    }
                };
            } catch (error) {
                console.error('Error during JWT validation:', error);
                return { isValid: false };
            } finally {
                if (connection) connection.release();
            }
        }
    });

    // Set default otentikasi untuk semua route yang memerlukan
    // server.auth.default('jwt'); // Anda bisa atur ini jika mayoritas endpoint butuh JWT

    server.route(routes);

    await server.start();
};

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
});

// Tambahkan log saat server berhasil dijalankan
init().then(() => {
    console.log('Server berjalan pada:', `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}`);
});

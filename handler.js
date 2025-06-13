// handler.js
import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import generateTokens from './utils/generateTokens.js';
import mysql from 'mysql2/promise';
import dbConfig from './utils/connection.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // Tidak diperlukan jika tidak menyimpan file lokal

// Buat pool koneksi database
const pool = mysql.createPool(dbConfig);

// Konfigurasi JWT dan token expiration
const JWT_SECRET = process.env.JWT_SECRET || 'm4Rt4B4kMan15SaNg4tEn4K123';
const ACCESS_TOKEN_EXPIRATION = process.env.ACCESS_TOKEN_EXPIRATION || '15m';
const REFRESH_TOKEN_EXPIRATION_DB_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRATION_DB_DAYS) || 7;
const REFRESH_TOKEN_EXPIRATION_COOKIE_MS = REFRESH_TOKEN_EXPIRATION_DB_DAYS * 24 * 60 * 60 * 1000;

export const getStaticContent = {
  directory: {
    path: 'public',
    listing: true
  }
};

// Handler baru untuk melayani aset Vite dari folder dist
export const getViteDistContent = {
    directory: {
        path: path.join(__dirname, '.', 'dist'), // Menunjuk ke folder 'dist' di root project
        listing: false, // Biasanya tidak ingin listing direktori untuk produksi
        index: true // Melayani index.html jika path adalah root folder dist
    }
};

// --- Handler untuk POST /register --- (Tidak ada perubahan di sini)
export const registerHandler = async (request, h) => {

  console.log('Headers:', request.headers);
  console.log('Payload:', request.payload);

  const { email, password } = request.payload;

  console.log('ada yang register :', {email, password});

  let connection;
  try {
    connection = await pool.getConnection();

    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return h.response({ message: 'Email sudah terdaftar.' }).code(409);
    }

    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);
    const publicId = nanoid(16);

    const [result] = await connection.execute(
      `INSERT INTO users (public_id, email, password_hash, salt)
        VALUES (?, ?, ?, ?)`,
      [publicId, email, hashedPassword, salt]
    );

    if (result.affectedRows === 0) {
      throw new Error('Gagal menyimpan pengguna baru.');
    }

    const { accessToken, refreshToken } = generateTokens(publicId, email);

    const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRATION_COOKIE_MS);

    await connection.execute(
      `INSERT INTO refresh_tokens (user_public_id, token, expires_at)
        VALUES (?, ?, ?)`,
      [publicId, refreshToken, refreshTokenExpiresAt]
    );

    return h.response({
      id: publicId,
      email: email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessToken: accessToken,
      refreshTokenExpired: refreshTokenExpiresAt.toISOString(),
      message: 'Registrasi berhasil!'
    }).code(201);

  } catch (error) {
    console.error('Error during registration:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return h.response({ message: 'Kesalahan duplikasi data (email sudah terdaftar). Coba lagi.' }).code(409);
    }
    return h.response({ message: 'Terjadi kesalahan saat registrasi.' }).code(500);
  } finally {
    if (connection) connection.release();
  }
};


export const loginHandler = async (request, h) => {
  const { email, password } = request.payload;

  let connection;
  try {
    connection = await pool.getConnection();

    const [users] = await connection.execute(
      'SELECT id, public_id, email, password_hash, salt, created_at, updated_at FROM users WHERE email = ?',
      [email]
    );

    const user = users[0];

    if (!user) {
      return h.response({ message: 'Email atau password salah.' }).code(401);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return h.response({ message: 'Email atau password salah.' }).code(401);
    }

    const { accessToken, refreshToken } = generateTokens(user.public_id, user.email);

    const refreshTokenExpiresAtDB = new Date(Date.now() + REFRESH_TOKEN_EXPIRATION_COOKIE_MS);

    await connection.execute(
      'DELETE FROM refresh_tokens WHERE user_public_id = ?',
      [user.public_id]
    );
    await connection.execute(
      `INSERT INTO refresh_tokens (user_public_id, token, expires_at)
        VALUES (?, ?, ?)`,
      [user.public_id, refreshToken, refreshTokenExpiresAtDB]
    );

    await connection.execute(
      `UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE public_id = ?`,
      [user.public_id]
    );

    return h.response({
      id: user.public_id,
      email: user.email,
      accessToken: accessToken,
      refreshToken: refreshToken,
      refreshTokenExpired: refreshTokenExpiresAtDB.toISOString(),
      message: 'Login berhasil!'
    })
    .state('refreshToken', refreshToken, {
      ttl: REFRESH_TOKEN_EXPIRATION_COOKIE_MS,
      isSecure: process.env.NODE_ENV === 'production',
      isHttpOnly: true,
      path: '/',
    }).code(200);

  } catch (error) {
    console.error('Error during login:', error);
    return h.response({ message: 'Terjadi kesalahan saat login.' }).code(500);
  } finally {
    if (connection) connection.release();
  }
};

// --- Handler untuk POST /refresh-token (saat access token expired) 
export const refreshTokensHandler = async (request, h) => {
  const refreshTokenFromCookie = request.state.refreshToken;

  if (!refreshTokenFromCookie) {
    return h.response({ message: 'Refresh token tidak ditemukan di cookie.' }).code(401);
  }

  let connection;
  try {
    connection = await pool.getConnection();

    const decoded = jwt.verify(refreshTokenFromCookie, JWT_SECRET);
    const userPublicId = decoded.publicId;

    const [tokensInDb] = await connection.execute(
      `SELECT token, expires_at FROM refresh_tokens
        WHERE user_public_id = ? AND token = ?`,
      [userPublicId, refreshTokenFromCookie]
    );

    const storedToken = tokensInDb[0];

    if (!storedToken) {
      console.warn(`Refresh token tidak ditemukan atau tidak cocok untuk user ${userPublicId}`);
      await connection.execute(
        'DELETE FROM refresh_tokens WHERE user_public_id = ?',
        [userPublicId]
      );
      return h.response({ message: 'Refresh token tidak valid atau sudah dicabut. Mohon login ulang.' }).code(401);
    }

    if (new Date() > new Date(storedToken.expires_at)) {
      console.warn(`Refresh token expired di DB untuk user ${userPublicId}`);
      await connection.execute(
        'DELETE FROM refresh_tokens WHERE user_public_id = ?',
        [userPublicId]
      );
      return h.response({ message: 'Refresh token telah kadaluarsa. Mohon login ulang.' }).code(401);
    }

    const newAccessToken = jwt.sign({ publicId: userPublicId, email: decoded.email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION });

    return h.response({
      accessToken: newAccessToken,
      message: 'Access token berhasil diperbarui.'
    }).code(200);

  } catch (error) {
    console.error('Error refreshing token:', error);
    if (error.name === 'TokenExpiredError') {
      const decodedExpired = jwt.decode(refreshTokenFromCookie);
      if (decodedExpired && decodedExpired.publicId) {
        await connection.execute(
          'DELETE FROM refresh_tokens WHERE user_public_id = ? AND token = ?',
          [decodedExpired.publicId, refreshTokenFromCookie]
        );
      }
      return h.response({ message: 'Refresh token telah kadaluarsa (JWT expired). Mohon login ulang.' }).code(401);
    }
    return h.response({ message: 'Terjadi kesalahan saat memperbarui token. Mohon login ulang.' }).code(401);
  } finally {
    if (connection) connection.release();
  }
};

// --- Handler untuk GET /api/testimonials ---
export const getTestimonialsHandler = async (request, h) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT id, user_public_id as userId, name, content, avatar_data FROM testimonials ORDER BY created_at DESC'
        );

        console.log('Fetched testimonials from DB:', rows.length, 'items');
        if (rows.length > 0) {
            console.log('First testimonial avatar_data length:', rows[0].avatar_data ? rows[0].avatar_data.length : 'null');
        }

        // Konversi data biner avatar ke Base64 untuk dikirim ke frontend
        const testimonialsWithAvatar = rows.map(t => ({
            ...t,
            avatar: t.avatar_data ? `data:image/jpeg;base64,${Buffer.from(t.avatar_data).toString('base64')}` : null // Asumsi JPEG, sesuaikan mime type jika perlu
        }));

        return h.response(testimonialsWithAvatar).code(200);
    } catch (error) {
        console.error('Error fetching testimonials:', error);
        return h.response({ message: 'Gagal memuat testimoni.', error: error.message }).code(500);
    } finally {
        if (connection) connection.release();
    }
};

// --- Handler untuk POST /api/testimonials ---
export const postTestimonialHandler = async (request, h) => {
    const { name, content, avatar } = request.payload; // 'avatar' sekarang adalah buffer data biner jika ada
    const userPublicId = request.auth.credentials.publicId;

    console.log('--- Debug Post Testimonial ---');
    console.log('Payload.name:', name);
    console.log('Payload.content:', content);
    console.log('Payload.avatar:', avatar); // Lihat ini!
    if (avatar && avatar._data) {
        console.log('Avatar _data length:', avatar._data.length);
    } else {
        console.log('Avatar _data is missing or null.');
    }
    console.log('------------------------------');

    let connection;
    let avatarData = null;

    try {
        connection = await pool.getConnection();

        if (Buffer.isBuffer(avatar)) { // <--- PERUBAHAN UTAMA DI SINI
            avatarData = avatar; // 'avatar' itu sendiri adalah Buffer
            console.log('Avatar data buffer length (POST):', avatarData.length); // Debugging
        } else {
            console.log('No avatar data (POST) or its not a buffer.'); // Debugging
        }

        const [result] = await connection.execute(
            `INSERT INTO testimonials (user_public_id, name, content, avatar_data)
             VALUES (?, ?, ?, ?)`,
            [userPublicId, name, content, avatarData]
        );

        if (result.affectedRows === 0) {
            throw new Error('Gagal menambahkan testimoni.');
        }

        const newTestimonialId = result.insertId;
        return h.response({
            id: newTestimonialId,
            userId: userPublicId,
            name,
            content,
            avatar: avatarData ? `data:image/jpeg;base64,${Buffer.from(avatarData).toString('base64')}` : null, // Kembalikan Base64 untuk frontend
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            message: 'Testimoni berhasil ditambahkan.'
        }).code(201);

    } catch (error) {
        console.error('Error adding testimonial:', error);
        return h.response({ message: 'Terjadi kesalahan saat menambahkan testimoni.', error: error.message }).code(500);
    } finally {
        if (connection) connection.release();
    }
};

// --- Handler untuk PUT /api/testimonials/{id} ---
export const putTestimonialHandler = async (request, h) => {
    
    const testimonialId = request.params.id;
    const { name, content, avatar } = request.payload; // 'avatar' bisa berupa buffer baru atau string null/kosong
    const userPublicId = request.auth.credentials.publicId;
    
    console.log('--- Debug Put Testimonial ---');
    console.log('Testimonial ID:', testimonialId);
    console.log('Payload.name:', name);
    console.log('Payload.content:', content);
    console.log('Payload.avatar:', avatar); // Lihat ini!
    if (avatar && avatar._data) {
        console.log('Avatar _data length:', avatar._data.length);
    } else {
        console.log('Avatar _data is missing or null.');
    }
    console.log('------------------------------');

    let connection;
    let newAvatarData = null; // Ini akan menjadi data biner avatar yang baru jika diupload/dipertahankan

    try {
        connection = await pool.getConnection();

        // 1. Dapatkan testimoni lama untuk verifikasi kepemilikan
        const [oldTestimonials] = await connection.execute(
            'SELECT user_public_id, avatar_data FROM testimonials WHERE id = ?',
            [testimonialId]
        );

        if (oldTestimonials.length === 0) {
            return h.response({ message: 'Testimoni tidak ditemukan.' }).code(404);
        }

        const oldTestimonial = oldTestimonials[0];

        // 2. Verifikasi kepemilikan
        if (oldTestimonial.user_public_id !== userPublicId) {
            return h.response({ message: 'Anda tidak memiliki izin untuk mengedit testimoni ini.' }).code(403);
        }

        // --- Logika Update Avatar ---
        if (Buffer.isBuffer(avatar)) { // <--- PERUBAHAN UTAMA DI SINI: Cek apakah avatar adalah Buffer
            newAvatarData = avatar; // 'avatar' itu sendiri adalah Buffer
            console.log('New avatar data buffer length (PUT):', newAvatarData.length); // Debugging
        } else if (avatar === null || avatar === '') { // Jika klien secara eksplisit menghapus avatar
            newAvatarData = null; // Set ke NULL di DB
            console.log('Avatar explicitly set to null (PUT).'); // Debugging
        } else {
            // Jika tidak ada data biner baru diupload dan bukan penghapusan eksplisit, pertahankan data lama
            newAvatarData = oldTestimonial.avatar_data;
            console.log('Retaining old avatar data (PUT).'); // Debugging
        }


        const [result] = await connection.execute(
            `UPDATE testimonials
             SET name = ?, content = ?, avatar_data = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [name, content, newAvatarData, testimonialId]
        );

        if (result.affectedRows === 0) {
            return h.response({ message: 'Testimoni tidak ditemukan atau tidak ada perubahan.' }).code(404);
        }

        return h.response({
            id: testimonialId,
            userId: userPublicId,
            name,
            content,
            avatar: newAvatarData ? `data:image/jpeg;base64,${Buffer.from(newAvatarData).toString('base64')}` : null, // Kembalikan Base64
            message: 'Testimoni berhasil diperbarui.'
        }).code(200);

    } catch (error) {
        console.error('Error updating testimonial:', error);
        return h.response({ message: 'Terjadi kesalahan saat memperbarui testimoni.', error: error.message }).code(500);
    } finally {
        if (connection) connection.release();
    }
};

// --- Handler untuk DELETE /api/testimonials/{id} ---
export const deleteTestimonialHandler = async (request, h) => {
    const testimonialId = request.params.id;
    const userPublicId = request.auth.credentials.publicId;

    let connection;
    try {
        connection = await pool.getConnection();

        const [oldTestimonials] = await connection.execute(
            'SELECT user_public_id FROM testimonials WHERE id = ?', // Tidak perlu avatar_data di sini
            [testimonialId]
        );

        if (oldTestimonials.length === 0) {
            return h.response({ message: 'Testimoni tidak ditemukan.' }).code(404);
        }

        const oldTestimonial = oldTestimonials[0];

        if (oldTestimonial.user_public_id !== userPublicId) {
            return h.response({ message: 'Anda tidak memiliki izin untuk menghapus testimoni ini.' }).code(403);
        }

        const [result] = await connection.execute(
            'DELETE FROM testimonials WHERE id = ?',
            [testimonialId]
        );

        if (result.affectedRows === 0) {
            return h.response({ message: 'Testimoni tidak ditemukan atau tidak dapat dihapus.' }).code(404);
        }

        // Tidak perlu menghapus file dari disk karena data disimpan di DB

        return h.response({ message: 'Testimoni berhasil dihapus.' }).code(200);

    } catch (error) {
        console.error('Error deleting testimonial:', error);
        return h.response({ message: 'Terjadi kesalahan saat menghapus testimoni.', error: error.message }).code(500);
    } finally {
        if (connection) connection.release();
    }
};

// --- Handler Baru: POST /api/recommend ---
export const postRecommendHandler = async (request, h) => {
    const { skin_type, skin_concern, skin_goal, ingredient, age, price_min, price_max, category } = request.payload;

    const externalApiUrl = 'https://skinthesia-api-production.up.railway.app/recommend';

    try {
        // Buat payload untuk API eksternal
        const externalPayload = {
            skin_type,
            skin_concern,
            skin_goal,
            ingredient,
            age,
            price_min,
            price_max,
            category
        };

        // Lakukan fetch ke API eksternal
        const response = await fetch(externalApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Tambahkan header lain jika API eksternal memerlukan (misal: API Key)
                // 'x-api-key': 'YOUR_EXTERNAL_API_KEY'
            },
            body: JSON.stringify(externalPayload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Error from external recommendation API:', data);
            return h.response({ 
                message: data.message || 'Gagal mendapatkan rekomendasi dari API eksternal.' 
            }).code(response.status);
        }

        // Kembalikan respons dari API eksternal langsung ke frontend
        return h.response(data).code(200);

    } catch (error) {
        console.error('Error calling external recommendation API:', error);
        return h.response({ 
            message: 'Terjadi kesalahan saat memproses rekomendasi.', 
            error: error.message 
        }).code(500);
    }
};

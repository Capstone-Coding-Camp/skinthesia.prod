// options.js
import Joi from 'joi';

export const getStaticContentOption = {
  tags: ['api'],
  description: 'Akses file statis'
};

// Opsi baru untuk melayani konten dist Vite
export const getViteDistContentOption = {
    tags: ['web'], // Tag baru untuk membedakan dari API, atau sesuaikan
    description: 'Melayani file frontend dari folder dist Vite',
    notes: 'Digunakan untuk menyajikan aplikasi frontend yang sudah di-build oleh Vite.'
};

export const getUserWithIdOption = {
  tags: ['api', 'users'],
  description: 'Mendapatkan data pengguna',
  validate: {
    params: Joi.object({
      id: Joi.number().integer().required().description('ID pengguna')
    })
  }
};

export const getLandingPageOption = {
  tags: ['api'],
  description: 'Endpoint utama'
};

export const registerHandlerOption = {
  tags: ['api', 'auth'],
  description: 'Mendaftarkan pengguna baru',
  notes: 'Membuat akun pengguna baru dengan email dan password, lalu mengembalikan token akses dan refresh token.',
  // validate: {
  //   payload: Joi.object({
  //     email: Joi.string().email().required().description('Email pengguna yang akan didaftarkan'),
  //     password: Joi.string().min(6).required().description('Password pengguna (minimal 6 karakter)')
  //   }).options({ allowUnknown: true })
  // }
}

export const loginHandlerOption = {
  tags: ['api', 'auth'],
  description: 'Login pengguna',
  notes: 'Menerima email dan password, mengembalikan token akses dan refresh token.',
  validate: {
    payload: Joi.object({
      email: Joi.string().email().required().description('Email pengguna yang akan login'),
      password: Joi.string().required().description('Password pengguna')
    })
  }
};

export const refreshTokensHandlerOption = {
  tags: ['api', 'auth'],
  description: 'Memperbarui Access Token',
  notes: 'Menggunakan Refresh Token dari cookie untuk mendapatkan Access Token baru. Membutuhkan refresh token di httpOnly cookie.',
  validate: {
      // Tidak ada payload, karena refresh token diambil dari cookie
  },
  
};

// --- Opsi untuk Testimonial API ---
export const getTestimonialsOption = {
    tags: ['api', 'testimonials'],
    description: 'Mendapatkan semua testimoni',
    notes: 'Mengembalikan daftar semua testimoni yang ada, termasuk data Base64 avatar.',
};

export const postTestimonialOption = {
  tags: ['api', 'testimonials'],
  description: 'Menambahkan testimoni baru',
  notes: 'Menambahkan testimoni yang dibuat oleh pengguna yang sedang login. Mengupload data biner avatar langsung ke DB.',
  validate: {
    payload: Joi.object({
      name: Joi.string().max(100).required().description('Nama pengisi testimoni'),
      content: Joi.string().max(255).required().description('Isi testimoni'),
      avatar: Joi.binary()
        .encoding('base64')
        .max(3 * 1024 * 1024)
        .optional()
        .description('Data biner file gambar avatar (opsional, maks 3MB)'),
    }).options({ allowUnknown: true }),
  },
  payload: {
    output: 'data',
    parse: true,
    allow: 'multipart/form-data',
    multipart: true,
    maxBytes: 3 * 1024 * 1024,
    failAction: (request, h, err) => {
      if (err.output.statusCode === 413) {
        throw new Error('Ukuran file avatar terlalu besar. Maksimal 3MB.');
      }
      throw err;
    }
  },
  // security: { 'jwt': [] }, // <-- Ini bukan properti standar Hapi, hanya untuk Swagger/OpenAPI
  auth: 'jwt', // <-- Gunakan ini untuk proteksi autentikasi di Hapi
};

export const putTestimonialOption = {
    tags: ['api', 'testimonials'],
    description: 'Mengupdate testimoni',
    notes: 'Memperbarui testimoni berdasarkan ID. Hanya pemilik testimoni yang dapat mengupdate. Mendukung penggantian data biner avatar.',
    validate: {
        params: Joi.object({
            id: Joi.number().integer().required().description('ID testimoni yang akan diupdate')
        }),
        payload: Joi.object({
            name: Joi.string().max(100).required().description('Nama pengisi testimoni'),
            content: Joi.string().max(255).required().description('Isi testimoni'),
            avatar: Joi.binary()
                .encoding('base64')
                .max(3 * 1024 * 1024)
                .allow(null, '')
                .optional()
                .description('Data biner file gambar avatar baru (opsional, maks 3MB) atau string kosong untuk menghapus'),
        }).options({ allowUnknown: true }),
    },
    payload: { // <--- LETAKKAN KONFIGURASI DI SINI
        output: 'data',
        parse: true,
        allow: 'multipart/form-data',
        multipart: true,
        maxBytes: 3 * 1024 * 1024,
        failAction: (request, h, err) => {
            if (err.output.statusCode === 413) {
                throw new Error('Ukuran file avatar terlalu besar. Maksimal 3MB.');
            }
            throw err;
        }
    },
  auth: 'jwt', // <-- Gunakan ini untuk proteksi autentikasi di Hapi
};

export const deleteTestimonialOption = {
    tags: ['api', 'testimonials'],
    description: 'Menghapus testimoni',
    notes: 'Menghapus testimoni berdasarkan ID. Hanya pemilik testimoni yang dapat menghapus.',
    validate: {
        params: Joi.object({
            id: Joi.number().integer().required().description('ID testimoni yang akan dihapus')
        })
    },
    auth: 'jwt', // <-- Gunakan ini untuk proteksi autentikasi di Hapi
    
};

// --- Opsi Baru: POST /api/recommend ---
export const postRecommendOption = {
    tags: ['api', 'recommendation'], // Tag baru untuk pengelompokan di Swagger
    description: 'Mendapatkan rekomendasi produk kosmetik',
    notes: 'Mengirimkan preferensi kulit untuk mendapatkan rekomendasi dari API eksternal.',
    validate: {
        payload: Joi.object({
            skin_type: Joi.string().valid('oily', 'dry', 'normal', 'combination').required().description('Tipe kulit (oily, dry, normal, combination, sensitive)'),
            skin_concern: Joi.string().valid('acne', 'blackheads', 'sensitive', 'irritation', 'redness', 'pores', 'dryness', 'fine lines', 'wrinkles', 'oiliness', 'hyperpigmentation', 'tiny bumps', 'dark spots', 'whiteheads', 'dull skin').required().description('Permasalahan kulit (acne, dark spots, dullness, aging, redness, dryness)'),
            skin_goal: Joi.string().valid('brightening', 'hydrating', 'smoothing', 'calming', 'fast-absorbing', 'pore-minimizing', 'barrier-repair', 'tone-evening', 'glowing', 'oil-control', 'non-comedogenic', 'nourishing', 'scar-fading', 'refreshing', 'regenerating', 'plumping', 'healthy', 'lightweight', 'anti-aging', 'firming').required().description('Tujuan perawatan kulit (brightening, hydrating, anti-aging, acne treatment, soothing, firming)'),
            ingredient: Joi.string().allow('').optional().description('Bahan aktif yang diinginkan (misal: niacinamide, hyaluronic acid)'),
            age: Joi.string().valid('under 18', '19 - 24', '25 - 29','30 - 34', '35 - 39').required().description('Rentang usia pengguna'),
            price_min: Joi.number().min(0).required().description('Harga minimal produk'),
            price_max: Joi.number().min(Joi.ref('price_min')).required().description('Harga maksimal produk'),
            category: Joi.string().valid('Toner', 'Serum & Essence', 'Moisturizer Gel', 'Moisturizer Lotion', 'Moisturizer Cream', 'Sun Protection', 'Facial Wash', 'Mask', 'Peeling', 'Exfoliator', 'Acne treatment').required().description('Kategori produk (Toner, Serum, Moisturizer, Cleanser, Sunscreen, Mask)'),
        }).label('RecommendationRequestPayload'), // Label untuk Swagger Model
    },
    // Endpoint ini diasumsikan tidak memerlukan otentikasi JWT karena hanya meneruskan permintaan.
    // Jika API eksternal memerlukan API Key, kelola itu di backend handler.
};
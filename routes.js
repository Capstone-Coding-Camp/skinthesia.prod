// routes.js
import {
  getStaticContentOption,
  getViteDistContentOption, 
  registerHandlerOption,
  loginHandlerOption,
  refreshTokensHandlerOption,
  getTestimonialsOption,
  postTestimonialOption,
  putTestimonialOption,
  deleteTestimonialOption,
  postRecommendOption
} from './options.js';

import {
  getStaticContent,
  getViteDistContent,
  registerHandler,
  loginHandler,
  refreshTokensHandler,
  getTestimonialsHandler,
  postTestimonialHandler,
  putTestimonialHandler,
  deleteTestimonialHandler,
  postRecommendHandler
} from './handler.js';

const routes = [
  // Route untuk file statis umum (jika ada)
  {
    method: 'GET',
    path: '/files/{param*}',
    handler: getStaticContent,
    options: getStaticContentOption,
  },
  {
    method: 'POST',
    path: '/api/register',
    handler: registerHandler,
    options: registerHandlerOption,
  },
  {
    method: 'POST',
    path: '/api/login',
    handler: loginHandler,
    options: loginHandlerOption,
  },
  {
    method: 'POST',
    path: '/api/refresh-token',
    handler: refreshTokensHandler,
    options: {
      ...refreshTokensHandlerOption,
      // auth: 'jwt' // Tidak perlu auth JWT di sini karena ini endpoint untuk me-refresh token.
    }
  },
  // --- ROUTES API UNTUK TESTIMONIALS ---
  {
    method: 'GET',
    path: '/api/testimonials',
    handler: getTestimonialsHandler,
    options: getTestimonialsOption,
  },
  {
    method: 'POST',
    path: '/api/testimonials',
    handler: postTestimonialHandler,
    options: {
      ...postTestimonialOption,
      auth: 'jwt',
    }
  },
  {
    method: 'PUT',
    path: '/api/testimonials/{id}',
    handler: putTestimonialHandler,
    options: {
      ...putTestimonialOption,
      auth: 'jwt',
    }
  },
  {
    method: 'DELETE',
    path: '/api/testimonials/{id}',
    handler: deleteTestimonialHandler,
    options: {
      ...deleteTestimonialOption,
      auth: 'jwt',
    }
  },
  // --- ROUTE /api/recommend ---
  {
    method: 'POST',
    path: '/api/recommend',
    handler: postRecommendHandler,
    options: postRecommendOption, // Gunakan opsi validasi yang baru
  },
  {
    method: 'GET',
    path: '/{param*}', // Ini akan menangani semua path yang tidak cocok dengan route sebelumnya
    handler: getViteDistContent,
    options: getViteDistContentOption,
  },
];

export default routes;
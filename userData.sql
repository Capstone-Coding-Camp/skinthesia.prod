
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(16) UNIQUE NOT NULL, -- ID 16 digit random yang akan Anda tampilkan/gunakan
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Otomatis update
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP
);

CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_public_id VARCHAR(16) NOT NULL, -- Menghubungkan ke public_id di tabel users
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_public_id) REFERENCES users(public_id) ON DELETE CASCADE
);

CREATE TABLE testimonials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_public_id VARCHAR(16) NOT NULL, -- Merujuk ke public_id di tabel users
    name VARCHAR(100) NOT NULL, -- Nama user pengisi testimonial
    content TEXT NOT NULL, -- Isi testimonial
    avatar_data LONGBLOB, -- Ganti dengan LONGBLOB untuk data biner avatar
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_public_id) REFERENCES users(public_id) ON DELETE CASCADE
);
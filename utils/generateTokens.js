import dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';   const { sign, verify } = jwt;

// Ambil variabel lingkungan yang diperlukan
const JWT_SECRET = process.env.JWT_SECRET || 'superSecretKeyUntukJWTAnda';
const ACCESS_TOKEN_EXPIRATION = process.env.ACCESS_TOKEN_EXPIRATION || '15m';
const REFRESH_TOKEN_EXPIRATION_DB = (process.env.REFRESH_TOKEN_EXPIRATION_DB_DAYS || '7') + 'd';

const generateTokens = (publicId, email) => {
  const accessToken = jwt.sign({ publicId, email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION });
  const refreshToken = jwt.sign({ publicId, email }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRATION_DB });
  return { accessToken, refreshToken };
};

export default generateTokens;
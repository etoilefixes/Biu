import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// JWT_SECRET 必须显式配置：生产环境缺失则 fail-fast，开发环境缺失则警告并使用固定默认值
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProduction) {
    throw new Error(
      '生产环境必须设置 JWT_SECRET 环境变量，禁止使用默认密钥（否则可伪造任意用户身份）'
    );
  }
  console.warn(
    '[安全警告] 未设置 JWT_SECRET 环境变量，开发环境使用默认密钥。生产环境部署前必须配置 JWT_SECRET。'
  );
  jwtSecret = 'biu-dev-jwt-secret';
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};

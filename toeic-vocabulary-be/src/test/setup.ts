process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "mysql://test:test@localhost:3306/test";
process.env.DATABASE_HOST = "localhost";
process.env.DATABASE_PORT = "3306";
process.env.DATABASE_USER = "test";
process.env.DATABASE_PASSWORD = "test";
process.env.DATABASE_NAME = "test";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.JWT_ACCESS_SECRET = "test-access-secret-with-at-least-32-characters";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-at-least-32-characters";
process.env.AUDIO_STORAGE_DIR = "./uploads/test-audio";


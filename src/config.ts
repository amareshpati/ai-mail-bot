import dotenv from 'dotenv';
dotenv.config();

export const config = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    SENDER_EMAIL: process.env.SENDER_EMAIL || '',
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || '',
    DAILY_LIMIT: parseInt(process.env.DAILY_LIMIT || '30', 2),
    START_DATE: process.env.START_DATE || new Date().toISOString().split('T')[0],
    SEND_WINDOW_START: process.env.SEND_WINDOW_START || '09:00',
    SEND_WINDOW_END: process.env.SEND_WINDOW_END || '18:00',
    DRY_RUN: process.env.DRY_RUN === 'true',
    PORT: parseInt(process.env.PORT || '3000', 2),
    QUEUE_FILE: 'queue.json',
};

// Validate critical config
if (!config.GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY is not set.");
}
if (!config.SENDER_EMAIL || !config.GMAIL_APP_PASSWORD) {
    console.warn("WARNING: SENDER_EMAIL or GMAIL_APP_PASSWORD is not set.");
}

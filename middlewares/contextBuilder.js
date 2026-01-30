import jwt from 'jsonwebtoken';

export const contextBuilder = (req, res, next) => {
    // 1. Capture Real IP (Handled by Nginx headers)
    req.realIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // 2. Capture Cognito User ID from the Authorization Header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.decode(token); // Decode the JWT from Cognito
            req.userContext = {
                id: decoded?.sub || 'anonymous', // 'sub' is the unique Cognito ID
                email: decoded?.email || 'N/A'
            };
        } catch (err) {
            req.userContext = { id: 'invalid-token' };
        }
    } else {
        req.userContext = { id: 'anonymous' };
    }

    // 3. Initialize Journey Timers
    req.journey = {
        start: Date.now(),
        segments: { login_ms: 0, s3_upload_ms: 0, gemini_api_ms: 0, db_ms: 0 }
    };

    next();
};
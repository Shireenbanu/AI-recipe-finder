import winston from 'winston';

// Splunk-optimized JSON format
const splunkFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    return JSON.stringify({
      time: timestamp,
      level: level.toUpperCase(),
      event: message,
      ...metadata
    });
  })
);

const splunkLogger = winston.createLogger({
  format: splunkFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/splunk.log' })
  ]
});

// File Upload Events
export function logFileUpload(req, file, result) {
  splunkLogger.info('FILE_UPLOAD', {
    event_type: 'file_upload',
    user_id: req.body.userId || req.query.userId,
    ip_address: req.ip || req.connection.remoteAddress,
    user_agent: req.get('user-agent'),
    file_name: file.originalname,
    file_size: file.size,
    file_type: file.mimetype,
    s3_key: result.fileName,
    s3_url: result.fileUrl,
    upload_status: 'success',
    upload_duration_ms: req.uploadDuration
  });
}

export function logFileUploadError(req, file, error) {
  splunkLogger.error('FILE_UPLOAD_ERROR', {
    event_type: 'file_upload_error',
    user_id: req.body.userId || req.query.userId,
    ip_address: req.ip,
    user_agent: req.get('user-agent'),
    file_name: file?.originalname,
    file_size: file?.size,
    file_type: file?.mimetype,
    error_message: error.message,
    error_stack: error.stack,
    upload_status: 'failed'
  });
}

// File Access Events
export function logFileAccess(userId, fileName, ipAddress) {
  splunkLogger.info('FILE_ACCESS', {
    event_type: 'file_access',
    user_id: userId,
    ip_address: ipAddress,
    file_name: fileName,
    access_type: 'download',
    access_status: 'success'
  });
}

// Security Events
export function logSuspiciousFileUpload(req, file, reason) {
  splunkLogger.warn('SUSPICIOUS_FILE_UPLOAD', {
    event_type: 'suspicious_file_upload',
    severity: 'HIGH',
    user_id: req.body.userId,
    ip_address: req.ip,
    user_agent: req.get('user-agent'),
    file_name: file.originalname,
    file_size: file.size,
    file_type: file.mimetype,
    reason: reason,
    security_flag: true
  });
}

export function logPerformance(req, actionName, durationMs, extraData = {}) {
  // Capture basic user context for every performance log
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userId = req.userContext?.id || 'anonymous';

  splunkLogger.info(`PERFORMANCE_METRIC: ${actionName}`, {
    event_type: 'performance',
    action: actionName,
    duration_ms: durationMs,
    security: {
      ip_address: clientIp,
      user_id: userId,
    },
    ...extraData // Any additional info (e.g., s3_bucket_name, file_size)
  });
}

export default splunkLogger;
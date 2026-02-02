import winston from 'winston';
import geoip from 'geoip-lite';


// Helper to extract the real client IP and its location
const getClientContext = (req) => {
  // CloudWatch format: "client, proxy" -> we take the first one
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const clientIp = rawIp.split(',')[0].trim();
  
  const geo = geoip.lookup(clientIp);
  
  return {
    ip_address: clientIp,
    region: geo ? `${geo.city}, ${geo.region}, ${geo.country}` : 'Unknown',
    country: geo ? geo.country : 'Unknown'
  };
};

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

export function logFileUpload(req, file, extra = {}) {
  const action = "S3_FILE_UPLOAD"
  const fileData = {
    file_name: file?.originalname,
    file_size: file?.size,
    file_type: file?.mimetype,
    ...extra
  };

  logPerformance(req, action, req.uploadDuration, 'SUCCESS', fileData);
}

/**
 * Standardized File Upload Error Logger
 * Includes Geo-location and full error stack for debugging
 */
export function logFileUploadError(req, file, error, duration = 0) {
  const { ip_address, region } = getClientContext(req);
  const userId = req?.body?.userId || req?.query?.userId || 'anonymous';

  splunkLogger.error(`EVENT: FILE_UPLOAD_FAILURE`, {
    event_type: 'performance', // Kept as performance to track error latency
    action: 'S3_FILE_UPLOAD',
    status: 'FAILURE',
    duration_ms: duration,
    geo_location: region,
    security: {
      ip_address: ip_address,
      user_id: userId,
    },
    session_id: req?.headers?.['x-session-id'] || "no-session",
    error_details: {
      message: error.message,
      stack: error.stack, // Critical for identifying where the code broke
    },
    file_metadata: {
      file_name: file?.originalname,
      file_size: file?.size,
      file_type: file?.mimetype
    },
    user_agent: req?.get?.('user-agent')
  });
}


// Security Events
/**
 * Standardized Security/Suspicious Event Logger
 * Maps security threats into the unified format with Geo-location
 */
export function logSuspiciousFileUpload(req, file, reason) {
  const { ip_address, region } = getClientContext(req);
  const userId = req?.body?.userId || req?.query?.userId || 'anonymous';

  splunkLogger.warn(`SECURITY_ALERT: SUSPICIOUS_FILE_UPLOAD`, {
    event_type: 'security_alert',
    action: 'SUSPICIOUS_FILE_UPLOAD',
    status: 'FLAGGED',
    severity: 'HIGH',
    duration_ms: 0, // Security rejections are usually near-instant
    geo_location: region,
    security: {
      ip_address: ip_address,
      user_id: userId,
      security_flag: true,
      reason: reason
    },
    file_metadata: {
      file_name: file?.originalname,
      file_size: file?.size,
      file_type: file?.mimetype
    },
    user_agent: req.get('user-agent'),
    session_id: req?.headers?.['x-session-id'] || "no-session"
  });
}

export function logPerformance(req, actionName, durationMs, status = 'SUCCESS', extraData = {}) {
  const { ip_address, region } = getClientContext(req);
  const userId = req.userContext?.id || req.body?.userId || req.query?.userId || 'anonymous';

  splunkLogger.info(`PERFORMANCE_METRIC: ${actionName}`, {
    event_type: 'performance',
    action: actionName,
    status: status, // Added SUCCESS or FAILURE
    duration_ms: durationMs,
    geo_location: region, // Added Geographical region
    security: {
      ip_address: ip_address,
      user_id: userId,
    },
    session_id: req.headers['x-session-id'] || "no-session",
    ...extraData
  });
}

// Helper to wrap DB calls with performance logging
export async function trackRDS(req, action, taskFn, extraData = {}) {
  const startTime = Date.now();
  try {
    const result = await taskFn();
    // Log with SUCCESS status
    logPerformance(req, `RDS_${action}`, Date.now() - startTime, 'SUCCESS', extraData);
    return result;
  } catch (error) {
    // Log with FAILURE status and include error message
    logPerformance(req, `RDS_${action}`, Date.now() - startTime, 'FAILURE', { 
      error: error.message,
      ...extraData 
    });
    throw error;
  }
}

export default splunkLogger;
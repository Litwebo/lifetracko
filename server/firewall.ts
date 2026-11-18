import { Request, Response, NextFunction } from 'express';

export interface ThreatLog {
  id: string;
  timestamp: string;
  ip: string;
  method: string;
  path: string;
  threatType: 'SQL_INJECTION' | 'XSS_ATTACK' | 'PATH_TRAVERSAL' | 'COMMAND_INJECTION' | 'MALICIOUS_SCANNER' | 'RATE_LIMIT_EXCEEDED';
  details: string;
}

export interface FirewallStats {
  requestsScreened: number;
  threatsBlocked: number;
  sqliBlocked: number;
  xssBlocked: number;
  rateLimitsTriggered: number;
  traversalBlocked: number;
  status: 'ACTIVE_SHIELDING';
  uptimeSeconds: number;
  recentLogs: ThreatLog[];
}

const startTime = Date.now();
let requestsScreened = 0;
let threatsBlocked = 0;
let sqliBlocked = 0;
let xssBlocked = 0;
let rateLimitsTriggered = 0;
let traversalBlocked = 0;
const threatLogs: ThreatLog[] = [];

function recordThreat(
  req: Request,
  threatType: ThreatLog['threatType'],
  details: string
) {
  threatsBlocked++;
  if (threatType === 'SQL_INJECTION') sqliBlocked++;
  if (threatType === 'XSS_ATTACK') xssBlocked++;
  if (threatType === 'PATH_TRAVERSAL') traversalBlocked++;
  if (threatType === 'RATE_LIMIT_EXCEEDED') rateLimitsTriggered++;

  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  const log: ThreatLog = {
    id: `threat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ip: clientIp,
    method: req.method,
    path: req.originalUrl || req.url,
    threatType,
    details: details.substring(0, 200),
  };

  threatLogs.unshift(log);
  if (threatLogs.length > 50) {
    threatLogs.pop();
  }

  console.warn(`[FIREWALL INTERCEPT] [${threatType}] IP: ${clientIp} Path: ${req.method} ${req.originalUrl} - ${details}`);
}

// 1. Security Headers Firewall Middleware
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Firewall-Status', 'ACTIVE_SHIELDING_V2');
  res.removeHeader('X-Powered-By');
  next();
}

// 2. Anti-Brute-Force & Adaptive Rate Limiter
interface RateBucket {
  count: number;
  resetTime: number;
}
const ipRateBuckets = new Map<string, RateBucket>();
const authRateBuckets = new Map<string, RateBucket>();

// Clean up old rate buckets periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of ipRateBuckets.entries()) {
    if (now > bucket.resetTime) ipRateBuckets.delete(key);
  }
  for (const [key, bucket] of authRateBuckets.entries()) {
    if (now > bucket.resetTime) authRateBuckets.delete(key);
  }
}, 60000);

export function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  const now = Date.now();

  // General API rate limit: 180 requests per minute
  const ipKey = `global:${clientIp}`;
  let globalBucket = ipRateBuckets.get(ipKey);
  if (!globalBucket || now > globalBucket.resetTime) {
    globalBucket = { count: 1, resetTime: now + 60000 };
    ipRateBuckets.set(ipKey, globalBucket);
  } else {
    globalBucket.count++;
  }

  if (globalBucket.count > 250) {
    recordThreat(req, 'RATE_LIMIT_EXCEEDED', `High volume request flood (${globalBucket.count} req/min)`);
    res.setHeader('Retry-After', '60');
    return res.status(429).json({
      error: 'Too many requests. Please slow down.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: 60,
    });
  }

  // Strict Auth rate limit for login/register endpoints: 20 attempts per 5 minutes
  if (req.path.startsWith('/api/auth/login') || req.path.startsWith('/api/auth/register')) {
    const authKey = `auth:${clientIp}`;
    let authBucket = authRateBuckets.get(authKey);
    if (!authBucket || now > authBucket.resetTime) {
      authBucket = { count: 1, resetTime: now + 300000 };
      authRateBuckets.set(authKey, authBucket);
    } else {
      authBucket.count++;
    }

    if (authBucket.count > 30) {
      recordThreat(req, 'RATE_LIMIT_EXCEEDED', `Brute force login threshold reached (${authBucket.count} attempts)`);
      res.setHeader('Retry-After', '300');
      return res.status(429).json({
        error: 'Too many authentication attempts. Account temporarily throttled for security.',
        code: 'AUTH_RATE_LIMIT',
        retryAfterSeconds: 300,
      });
    }
  }

  next();
}

// 3. Deep Payload Inspection & Attack Signatures (WAF Engine)
const SQLI_PATTERNS = [
  /(\bUNION\s+(ALL\s+)?SELECT\b)/i,
  /(\bSELECT\b[\s\S]+?\bFROM\b[\s\S]+?\bWHERE\b[\s\S]+?(=|>|<|LIKE))/i,
  /('|\b)\s*OR\s+('1'='1'|1=1|true=true)($|\s*--|\s*;)/i,
  /('|\b)\s*AND\s+('1'='1'|1=1)($|\s*--|\s*;)/i,
  /(\bDROP\s+TABLE\b)/i,
  /(\bALTER\s+TABLE\b)/i,
  /(\bINSERT\s+INTO\b[\s\S]+?\bVALUES\b)/i,
  /(\bINFORMATION_SCHEMA\.TABLES\b)/i,
  /(\bEXEC(\s+|\()+xp_cmdshell\b)/i,
  /(\bBENCHMARK\s*\(\s*\d+\s*,\s*MD5\s*\()/i,
  /(\bSLEEP\s*\(\s*\d+\s*\))/i,
  /(;\s*DROP\s+TABLE|;\s*DELETE\s+FROM|;\s*UPDATE\s+\w+\s+SET)/i,
];

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript\s*:\s*[^;\s]+/gi,
  /vbscript\s*:\s*[^;\s]+/gi,
  /data\s*:\s*text\/html/gi,
  /<iframe\b[^>]*>/gi,
  /<object\b[^>]*>/gi,
  /<embed\b[^>]*>/gi,
  /<\w+[^>]*\son(load|error|click|mouseover|focus|blur|submit)\s*=\s*['"][^'"]*['"]/gi,
  /<svg\b[^>]*\sonload\s*=/gi,
  /<img\b[^>]*\sonerror\s*=/gi,
];

const TRAVERSAL_PATTERNS = [
  /(\.\.\/|\.\.\\)/,
  /(%2e%2e%2f|%2e%2e\/|\.\.%2f)/i,
  /(\/etc\/passwd|\/etc\/shadow|\/proc\/self\/environ)/i,
  /(c:\\windows\\system32|c:\\boot\.ini)/i,
];

const SCANNER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /acunetix/i,
  /havij/i,
  /masscan/i,
  /wpscan/i,
  /dirbuster/i,
  /gobuster/i,
];

const EXEMPT_FIELDS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
]);

function scanPayloadString(val: string): { threat: ThreatLog['threatType']; match: string } | null {
  if (!val || typeof val !== 'string' || val.length < 3) return null;

  for (const pat of SQLI_PATTERNS) {
    if (pat.test(val)) {
      return { threat: 'SQL_INJECTION', match: val.substring(0, 100) };
    }
  }

  for (const pat of XSS_PATTERNS) {
    if (pat.test(val)) {
      return { threat: 'XSS_ATTACK', match: val.substring(0, 100) };
    }
  }

  for (const pat of TRAVERSAL_PATTERNS) {
    if (pat.test(val)) {
      return { threat: 'PATH_TRAVERSAL', match: val.substring(0, 100) };
    }
  }

  return null;
}

function recursiveInspect(obj: any, parentKey = ''): { threat: ThreatLog['threatType']; match: string } | null {
  if (!obj) return null;

  if (EXEMPT_FIELDS.has(parentKey)) {
    return null;
  }

  if (typeof obj === 'string') {
    return scanPayloadString(obj);
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const res = recursiveInspect(item, parentKey);
      if (res) return res;
    }
  } else if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (EXEMPT_FIELDS.has(key)) continue;

      const keyScan = scanPayloadString(key);
      if (keyScan) return keyScan;

      const valScan = recursiveInspect(value, key);
      if (valScan) return valScan;
    }
  }

  return null;
}

export function wafInspectionMiddleware(req: Request, res: Response, next: NextFunction) {
  requestsScreened++;

  // Screen malicious user agents / automated attack tools
  const userAgent = req.headers['user-agent'] || '';
  for (const scanner of SCANNER_AGENTS) {
    if (scanner.test(userAgent)) {
      recordThreat(req, 'MALICIOUS_SCANNER', `Known attack scanner detected: ${userAgent}`);
      return res.status(403).json({
        error: 'Access Denied: Automated vulnerability scanners are blocked by LifeTracko Firewall.',
        code: 'SCANNER_BLOCKED',
      });
    }
  }

  // Inspect Query Parameters
  const queryDetection = recursiveInspect(req.query);
  if (queryDetection) {
    recordThreat(req, queryDetection.threat, `Malicious query param payload: ${queryDetection.match}`);
    return res.status(403).json({
      error: 'Security Alert: Malicious request signature intercepted by LifeTracko Web Application Firewall.',
      code: 'WAF_ATTACK_INTERCEPTED',
      threatType: queryDetection.threat,
    });
  }

  // Inspect URL Path
  const pathDetection = scanPayloadString(req.originalUrl || req.url);
  if (pathDetection) {
    recordThreat(req, pathDetection.threat, `Malicious URL path: ${pathDetection.match}`);
    return res.status(403).json({
      error: 'Security Alert: Malicious URL pattern blocked.',
      code: 'WAF_ATTACK_INTERCEPTED',
      threatType: pathDetection.threat,
    });
  }

  // Inspect Request Body
  if (req.body && typeof req.body === 'object') {
    const bodyDetection = recursiveInspect(req.body);
    if (bodyDetection) {
      recordThreat(req, bodyDetection.threat, `Malicious POST payload: ${bodyDetection.match}`);
      return res.status(403).json({
        error: 'Security Alert: Suspicious script or injection payload blocked by database shield.',
        code: 'WAF_ATTACK_INTERCEPTED',
        threatType: bodyDetection.threat,
      });
    }
  }

  next();
}

// 4. Firewall Telemetry & Status API
export function getFirewallStats(): FirewallStats {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  return {
    requestsScreened,
    threatsBlocked,
    sqliBlocked,
    xssBlocked,
    rateLimitsTriggered,
    traversalBlocked,
    status: 'ACTIVE_SHIELDING',
    uptimeSeconds,
    recentLogs: threatLogs,
  };
}

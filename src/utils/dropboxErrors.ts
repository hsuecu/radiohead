export type DropboxErrorType = 
  | 'network'
  | 'auth'
  | 'permissions'
  | 'quota'
  | 'api'
  | 'file'
  | 'folder'
  | 'unknown';

export interface DropboxError {
  type: DropboxErrorType;
  code?: string;
  message: string;
  userMessage: string;
  actionable: string;
  retryable: boolean;
  details?: any;
}

export class DropboxErrorHandler {
  static categorizeError(error: any): DropboxError {
    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        type: 'network',
        message: 'Network request failed',
        userMessage: 'Unable to connect to Dropbox',
        actionable: 'Check your internet connection and try again',
        retryable: true,
        details: error
      };
    }

    // HTTP status code errors
    if (error.status || error.response?.status) {
      const status = error.status || error.response?.status;
      const responseData = error.response?.data || error.data;

      switch (status) {
        case 400:
          return {
            type: 'api',
            code: 'bad_request',
            message: 'Invalid request to Dropbox API',
            userMessage: 'Invalid request format',
            actionable: 'Please try again or contact support if the issue persists',
            retryable: false,
            details: responseData
          };

        case 401:
          return {
            type: 'auth',
            code: 'unauthorized',
            message: 'Authentication failed',
            userMessage: 'Your Dropbox connection has expired',
            actionable: 'Please reconnect your Dropbox account in Storage Settings',
            retryable: false,
            details: responseData
          };

        case 403:
          return {
            type: 'permissions',
            code: 'forbidden',
            message: 'Insufficient permissions',
            userMessage: 'Permission denied for this Dropbox operation',
            actionable: 'Check your app permissions or try a different folder',
            retryable: false,
            details: responseData
          };

        case 409:
          if (responseData?.error_summary?.includes('path/conflict')) {
            return {
              type: 'file',
              code: 'conflict',
              message: 'File or folder already exists',
              userMessage: 'A file with this name already exists',
              actionable: 'Choose a different name or enable auto-rename',
              retryable: false,
              details: responseData
            };
          }
          break;

        case 429:
          return {
            type: 'api',
            code: 'rate_limit',
            message: 'Rate limit exceeded',
            userMessage: 'Too many requests to Dropbox',
            actionable: 'Please wait a moment before trying again',
            retryable: true,
            details: responseData
          };

        case 507:
          return {
            type: 'quota',
            code: 'insufficient_space',
            message: 'Insufficient storage space',
            userMessage: 'Your Dropbox is full',
            actionable: 'Free up space in your Dropbox or upgrade your plan',
            retryable: false,
            details: responseData
          };

        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: 'api',
            code: 'server_error',
            message: 'Dropbox server error',
            userMessage: 'Dropbox is temporarily unavailable',
            actionable: 'Please try again in a few minutes',
            retryable: true,
            details: responseData
          };
      }
    }

    // Dropbox API specific errors
    if (error.error_summary || error.error) {
      const errorSummary = error.error_summary || error.error?.['.tag'] || '';
      
      if (errorSummary.includes('invalid_access_token')) {
        return {
          type: 'auth',
          code: 'invalid_token',
          message: 'Invalid access token',
          userMessage: 'Your Dropbox connection is invalid',
          actionable: 'Please reconnect your Dropbox account',
          retryable: false,
          details: error
        };
      }

      if (errorSummary.includes('expired_access_token')) {
        return {
          type: 'auth',
          code: 'expired_token',
          message: 'Access token expired',
          userMessage: 'Your Dropbox connection has expired',
          actionable: 'Reconnecting automatically...',
          retryable: true,
          details: error
        };
      }

      if (errorSummary.includes('insufficient_space')) {
        return {
          type: 'quota',
          code: 'insufficient_space',
          message: 'Insufficient storage space',
          userMessage: 'Not enough space in your Dropbox',
          actionable: 'Free up space or upgrade your Dropbox plan',
          retryable: false,
          details: error
        };
      }

      if (errorSummary.includes('path_not_found')) {
        return {
          type: 'folder',
          code: 'path_not_found',
          message: 'Folder not found',
          userMessage: 'The destination folder no longer exists',
          actionable: 'Please select a different folder or create a new one',
          retryable: false,
          details: error
        };
      }

      if (errorSummary.includes('malformed_path')) {
        return {
          type: 'folder',
          code: 'invalid_path',
          message: 'Invalid folder path',
          userMessage: 'The folder path contains invalid characters',
          actionable: 'Please choose a different folder name',
          retryable: false,
          details: error
        };
      }
    }

    // File system errors
    if (error.message?.includes('file not found') || error.code === 'ENOENT') {
      return {
        type: 'file',
        code: 'file_not_found',
        message: 'Local file not found',
        userMessage: 'The file to upload could not be found',
        actionable: 'Please try recording the audio again',
        retryable: false,
        details: error
      };
    }

    // Generic network timeout
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return {
        type: 'network',
        code: 'timeout',
        message: 'Request timeout',
        userMessage: 'The upload took too long',
        actionable: 'Check your connection and try again',
        retryable: true,
        details: error
      };
    }

    // Default unknown error
    return {
      type: 'unknown',
      message: error.message || 'Unknown error occurred',
      userMessage: 'An unexpected error occurred',
      actionable: 'Please try again or contact support',
      retryable: true,
      details: error
    };
  }

  static getRetryDelay(attempt: number, errorType: DropboxErrorType): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    
    let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    delay += jitter;
    
    // Special cases
    switch (errorType) {
      case 'api':
        // Rate limiting - longer delays
        delay *= 2;
        break;
      case 'network':
        // Network issues - shorter delays for quick recovery
        delay *= 0.5;
        break;
      case 'auth':
      case 'permissions':
      case 'quota':
        // These typically require user intervention
        return 0; // Don't retry
    }
    
    return Math.max(1000, delay); // Minimum 1 second
  }

  static shouldRetry(error: DropboxError, attempt: number, maxAttempts: number = 3): boolean {
    if (attempt >= maxAttempts) return false;
    if (!error.retryable) return false;
    
    // Don't retry certain error types
    if (['auth', 'permissions', 'quota', 'file'].includes(error.type)) {
      return false;
    }
    
    return true;
  }

  static formatErrorForUser(error: DropboxError, context?: string): string {
    let message = error.userMessage;
    
    if (context) {
      message = `${context}: ${message}`;
    }
    
    if (error.actionable) {
      message += `\n\n${error.actionable}`;
    }
    
    return message;
  }

  static getErrorIcon(errorType: DropboxErrorType): string {
    switch (errorType) {
      case 'network': return 'wifi-off';
      case 'auth': return 'lock-closed';
      case 'permissions': return 'shield-off';
      case 'quota': return 'archive';
      case 'api': return 'server';
      case 'file': return 'document-text';
      case 'folder': return 'folder';
      default: return 'alert-circle';
    }
  }

  static getErrorColor(errorType: DropboxErrorType): string {
    switch (errorType) {
      case 'network': return 'text-orange-600';
      case 'auth': return 'text-red-600';
      case 'permissions': return 'text-red-600';
      case 'quota': return 'text-yellow-600';
      case 'api': return 'text-blue-600';
      case 'file': return 'text-purple-600';
      case 'folder': return 'text-indigo-600';
      default: return 'text-gray-600';
    }
  }
}
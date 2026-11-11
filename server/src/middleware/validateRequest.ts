import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../utils/errors';

export function validateChatMessage(req: Request, res: Response, next: NextFunction): void {
  const { message, timezoneOffset } = req.body;

  if (message === undefined || message === null) {
    throw new BadRequestError("Missing required field: 'message'");
  }

  if (typeof message !== 'string') {
    throw new BadRequestError("Field 'message' must be a string");
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    throw new BadRequestError('Message cannot be empty or contain only whitespace');
  }

  if (trimmed.length > 8000) {
    throw new BadRequestError('Message exceeds maximum allowed length of 8000 characters');
  }

  if (timezoneOffset !== undefined) {
    if (typeof timezoneOffset !== 'number' || isNaN(timezoneOffset)) {
      throw new BadRequestError("Field 'timezoneOffset' must be a valid number of minutes");
    }
    // Timezone offsets across Earth range between -720 (UTC+12) and +840 (UTC-14)
    if (timezoneOffset < -840 || timezoneOffset > 840) {
      throw new BadRequestError("Field 'timezoneOffset' must be between -840 and 840 minutes");
    }
  }

  // Sanitize null bytes
  req.body.message = trimmed.replace(/\0/g, '');
  next();
}


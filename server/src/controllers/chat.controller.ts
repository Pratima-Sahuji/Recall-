import { Request, Response, NextFunction } from 'express';
import { ChatService } from '../services/chat.service';
import { AppError } from '../utils/errors';
import { ToolCallEvent } from '../services/llm.service';

export class ChatController {
  constructor(private chatService = new ChatService()) {}

  /**
   * Server-Sent Events (SSE) Streaming Chat Endpoint with Web Search Tool Support
   * POST /api/conversations/:conversationId/chat/stream
   */
  streamChat = async (req: Request, res: Response): Promise<void> => {
    const { conversationId } = req.params;
    const { message, timezoneOffset } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ status: 'fail', message: 'Message string is required' });
      return;
    }

    // Set Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    const sendEvent = (event: string, data: any) => {
      if (clientDisconnected) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await this.chatService.streamChat(
        conversationId,
        message,
        (chunk: string) => {
          sendEvent('chunk', { delta: chunk });
        },
        (toolEvent: ToolCallEvent) => {
          sendEvent('tool_call', toolEvent);
        },
        typeof timezoneOffset === 'number' ? timezoneOffset : undefined,
      );

      // Send completion event with persisted assistant message
      sendEvent('done', {
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
        recalledMemories: result.recalledMemories,
      });

      res.end();
    } catch (err: any) {
      console.error('[ChatController] Stream error:', err);
      const statusCode = err instanceof AppError ? err.statusCode : 500;
      const errorMessage = err.message || 'Error occurred while streaming response.';

      sendEvent('error', {
        statusCode,
        message: errorMessage,
      });

      res.end();
    }
  };

  /**
   * Standard Non-streaming Chat Endpoint
   * POST /api/conversations/:conversationId/chat
   */
  chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { conversationId } = req.params;
      const { message, timezoneOffset } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ status: 'fail', message: 'Message string is required' });
        return;
      }

      const toolEvents: ToolCallEvent[] = [];
      const result = await this.chatService.chat(
        conversationId,
        message,
        (e) => toolEvents.push(e),
        typeof timezoneOffset === 'number' ? timezoneOffset : undefined,
      );

      res.status(200).json({
        status: 'success',
        data: {
          ...result,
          toolEvents,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

import 'server-only';
import { NextResponse } from 'next/server';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Server-Sent Events response. `run` receives a `send` function and the stream closes when it settles.
 * `onCancel` fires if the browser disconnects first.
 */
export function sse<T>(run: (send: (event: T) => void) => Promise<void>, onCancel?: () => void): Response {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: T) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      run(send)
        .catch((error) => send({ type: 'error', message: errorMessage(error) } as T))
        .finally(() => {
          if (!closed) {
            closed = true;
            controller.close();
          }
        });
    },
    cancel() {
      closed = true;
      onCancel?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

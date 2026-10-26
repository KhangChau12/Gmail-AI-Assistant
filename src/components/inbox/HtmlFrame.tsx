'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Email HTML is untrusted: render it in a sandboxed iframe with scripts disabled.
 * `allow-same-origin` (without `allow-scripts`) only lets us measure the content height.
 * Newsletters assume a white page, so the frame keeps a light "paper" look in both themes.
 */
export function HtmlFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>
  html,body{margin:0;padding:0;background:#fff;color:#1c1f2b;font:15px/1.6 "Be Vietnam Pro",-apple-system,"Segoe UI",sans-serif;overflow-wrap:anywhere}
  body{padding:22px 24px}
  img{max-width:100%;height:auto}
  table{max-width:100%}
  a{color:#3a49c4}
  blockquote{margin:0 0 0 .6em;padding-left:.8em;border-left:2px solid #ddd;color:#666}
</style></head><body>${html}</body></html>`;

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let observer: ResizeObserver | undefined;
    const measure = () => {
      const root = frame.contentDocument?.documentElement;
      if (!root || !frame.contentDocument?.body) return;
      setHeight(Math.max(80, root.scrollHeight));
      observer?.disconnect();
      observer = new ResizeObserver(() => setHeight(Math.max(80, frame.contentDocument?.documentElement.scrollHeight ?? 80)));
      observer.observe(frame.contentDocument.body);
    };
    frame.addEventListener('load', measure);
    return () => {
      frame.removeEventListener('load', measure);
      observer?.disconnect();
    };
  }, [html]);

  return (
    <iframe
      ref={ref}
      title="Email content"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={doc}
      style={{ height }}
      className="w-full overflow-hidden rounded-card border border-line bg-white"
    />
  );
}

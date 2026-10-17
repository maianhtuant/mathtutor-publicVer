/** Splits question text into plain-text and LaTeX segments (pure, unit-testable). */

export type Segment = { math: boolean; text: string };

export type Kind = 'strong' | 'weak' | 'text';

/** strong: LaTeX or operators; weak: numbers / short variables like x, 3x (math only next to strong tokens). */
function classify(word: string): Kind {
  if (/[\\^_{}=]/.test(word) || /^[-+*/×÷<>≤≥()]+$/.test(word)) return 'strong';
  if (/^\(?-?\d+(\.\d+)?\)?$/.test(word) || /^-?\d*[a-zA-Z]$/.test(word)) return 'weak';
  return 'text';
}

/**
 * Split a prompt into text and math. Explicit $...$ or \( ... \) delimiters win; otherwise runs of
 * math-looking words are grouped, so "Calculate 2.4 \times 1.5." renders "2.4 \times 1.5" with KaTeX
 * and keeps "Calculate" and the final period as plain text.
 */
export function splitMath(source: string): Segment[] {
  if (/\$|\\\(/.test(source)) {
    const out: Segment[] = [];
    const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$|\\\(([\s\S]+?)\\\)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
      if (m.index > last) out.push({ math: false, text: source.slice(last, m.index) });
      out.push({ math: true, text: m[1] ?? m[2] ?? m[3] });
      last = re.lastIndex;
    }
    if (last < source.length) out.push({ math: false, text: source.slice(last) });
    return out;
  }
  const out: Segment[] = [];
  const push = (math: boolean, text: string) => {
    const prev = out[out.length - 1];
    if (prev && prev.math === math && !math) prev.text += text;
    else out.push({ math, text });
  };
  const tokens = source.split(/(\s+)/).filter((t) => t !== '');
  let run: string[] = [];
  let strong = false;
  const flush = (trailing = '') => {
    if (run.length) push(strong, run.join(''));
    if (trailing) push(false, trailing);
    run = [];
    strong = false;
  };
  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) {
      if (run.length) run.push(tok);
      else push(false, tok);
      continue;
    }
    const punct = tok.match(/[.,;:?!]+$/)?.[0] ?? '';
    const core = punct ? tok.slice(0, -punct.length) : tok;
    const kind = core ? classify(core) : 'text';
    if (kind === 'text') {
      // trailing whitespace inside the run belongs to the text that follows
      const ws: string[] = [];
      while (run.length && /^\s+$/.test(run[run.length - 1])) ws.unshift(run.pop()!);
      flush(ws.join(''));
      push(false, tok);
      continue;
    }
    run.push(core);
    if (kind === 'strong') strong = true;
    if (punct) flush(punct);
  }
  const ws: string[] = [];
  while (run.length && /^\s+$/.test(run[run.length - 1])) ws.unshift(run.pop()!);
  flush(ws.join(''));
  return out;
}

/**
 * Copy helper (spec 144 OD-144-6): clipboard API with a textarea +
 * execCommand fallback for non-secure contexts. Returns true on success,
 * false on failure — callers surface failures inline (the card shows a
 * "Copy failed" message), never silently. No catch block here is empty:
 * each failure path returns false so the caller can report it.
 */
async function tryClipboardApi(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function tryLegacyCopy(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (await tryClipboardApi(text)) return true;
  return tryLegacyCopy(text);
}

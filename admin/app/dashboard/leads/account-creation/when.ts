/** UTC like the Money page, written here on the server so the text never
 * differs between the server and the browser. */
export function when(iso: string): string {
  return `${new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })} UTC`;
}

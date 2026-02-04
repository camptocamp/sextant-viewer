const URL_REGEX = /\bhttps?:\/\/(?:\([^\s()]+\)|[^\s()]+)+/g

export function extractUrls(value: string): string[] {
  return [...value.matchAll(URL_REGEX)].map((match) => match[0])
}

export function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

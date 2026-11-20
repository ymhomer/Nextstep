export function mediaPath(url: string) {
  return /^\/api\/(images|files)\//.test(url)
    ? import.meta.env.BASE_URL + url.slice(1)
    : url;
}

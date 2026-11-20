declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}

declare const __NEXTSTEP_STANDALONE__: boolean;

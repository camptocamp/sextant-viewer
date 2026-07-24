/// <reference types="vite/client" />

declare module '*.css?inline' {
  const content: string
  export default content
}

interface ImportMetaEnv {
  /** Disable the ogc-client session cache (see main.ts). Set via vite.config.ts. */
  readonly VITE_DISABLE_OGC_CACHE?: boolean
}

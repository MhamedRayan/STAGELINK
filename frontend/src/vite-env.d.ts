/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" loads src/demo/directory.json for user names (demo only). */
  readonly VITE_DEMO_DIRECTORY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

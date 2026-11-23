/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_DIRECTORY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

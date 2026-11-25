/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_COMMIT?: string }
declare module '*.log?raw' {
  const content: string;
  export default content;
}

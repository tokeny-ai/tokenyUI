/** Sprite files are embedded by the desktop plugin build. */
declare module '*.webp' {
  const url: string
  export default url
}

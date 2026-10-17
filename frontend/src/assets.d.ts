/** Image imports resolve to their built URL (webpack asset/resource). */
declare module '*.png' {
  const src: string;
  export default src;
}

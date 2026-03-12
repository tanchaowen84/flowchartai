declare module 'gif.js.optimized' {
  export default class GIF {
    constructor(options?: any);
    addFrame(imageElement: any, options?: any): void;
    on(event: string, callback: Function): void;
    render(): void;
  }
}

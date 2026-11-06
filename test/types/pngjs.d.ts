declare module 'pngjs' {
  export class PNG {
    constructor(options?: { width?: number; height?: number });
    width: number;
    height: number;
    data: Uint8Array<ArrayBuffer>;
    static sync: {
      read(buffer: Uint8Array<ArrayBuffer>): PNG;
      write(png: PNG): Uint8Array<ArrayBuffer>;
    };
  }
}

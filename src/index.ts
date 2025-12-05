type ClassDesc = {}

const STREAM_MAGIC      = 0xaced;
const STREAM_VERSION    = 5;

const TC_NULL           = 0x70;
const TC_REFERENCE      = 0x71;
const TC_CLASSDESC      = 0x72;
const TC_OBJECT         = 0x73;
const TC_STRING         = 0x74;
const TC_ARRAY          = 0x75;
const TC_CLASS          = 0x76;
const TC_BLOCKDATA      = 0x77;
const TC_ENDBLOCKDATA   = 0x78;
const TC_RESET          = 0x79;
const TC_BLOCKDATALONG  = 0x7A;
const TC_EXCEPTION      = 0x7B;
const TC_LONGSTRING     = 0x7C;
const TC_PROXYCLASSDESC = 0x7D;
const TC_ENUM           = 0x7E;

const baseWireHandle    = 0x7E0000;

const SC_WRITE_METHOD   = 0x01;  // if SC_SERIALIZABLE
const SC_BLOCK_DATA     = 0x08;  // if SC_EXTERNALIZABLE
const SC_SERIALIZABLE   = 0x02;
const SC_EXTERNALIZABLE = 0x04;
const SC_ENUM           = 0x10;


class JavaException extends Error {}
class IOException extends JavaException {}
class ObjectStreamException extends IOException {}
class StreamCorruptedException extends ObjectStreamException {}
class EOFException extends IOException {}
class UTFDataFormatException extends IOException {}
class RuntimeException extends JavaException {}
class IllegalStateException extends RuntimeException {}
class IndexOutOfBoundsException extends RuntimeException {}

class NotImplementedError extends Error {}  // TODO remove before publishing

// Note: interface and class definitions are slightly different to Java

interface DataInput {
    readBoolean(): boolean
    readByte(): number
    readUnsignedByte(): number
    readChar(): string
    readShort(): number
    readUnsignedShort(): number
    readInt(): number
    readLong(): bigint
    readFloat(): number
    readDouble(): number
    readUtf(): string;
}

interface ObjectInput extends DataInput {
    readObject(): any;
}

abstract class InputStream {
    public abstract read1(): number;

    public read(len: number): Uint8Array {
        const result = new Uint8Array(len);
        let i=0;
        for (; i<len; i++) {
            const c = this.read1();
            if (c === -1) {
                break;
            }
            result[i] = c;
        }
        return result.slice(0, i);
    }

    public readFully(len: number): Uint8Array {
        const result = this.read(len);
        if (result.length < len) {
            throw new EOFException()
        }
        return result;
    }

    public skip(n: number): number {
        return this.read(n).length;
    }
}


class BasicInputStream extends InputStream {
    private data: Uint8Array;
    private offset = 0;

    constructor(data: Uint8Array) {
        super();
        this.data = data;
    }

    public read1(): number {
        if (this.offset < this.data.length) {
            return this.data[this.offset++];
        } else {
            return -1;
        }
    }
}


class PeekInputStream extends InputStream {
    private in: InputStream;
    private peekb: number = -1;

    constructor(in_: InputStream) {
        super();
        this.in = in_;
    }

    public peek(): number {
        if (this.peekb >= 0) {
            return this.peekb;
        }
        this.peekb = this.in.read1();
        return this.peekb;
    }

    public read1(): number {
        if (this.peekb >= 0) {
            const c = this.peekb;
            this.peekb = -1;
            return c;
        } else {
            const c = this.in.read1();
            return c;
        }
    }
}


class ObjectInputStream extends InputStream implements ObjectInput {
    private data: Uint8Array;
    private offset: number;

    constructor(data: Uint8Array) {
        super();
        this.data = data;
        this.offset = 0;

        if (this.readUnsignedShort() !== STREAM_MAGIC)   throw new StreamCorruptedException();
        if (this.readUnsignedShort() !== STREAM_VERSION) throw new StreamCorruptedException();
    }

    private eof(): boolean {
        return this.offset === this.data.length;
    }

    read1(): number {
        if (this.eof()) {
            return -1;
        }
        return this.read(1)[0];
    }

    read(length: number): Uint8Array {
        length = Math.min(length, this.data.length-this.offset);
        if (length < 0) throw new Error("Can't read a negative number of bytes");
        const result = this.data.slice(this.offset, this.offset + length);
        this.offset += length;
        return result
    }

    skipBytes(n: number): number {
        return this.skip(n);
    }

    private peekByte(): number {
        if (this.eof()) throw new EOFException();
        return this.data[this.offset];
    }

    readBoolean(): boolean {
        return ByteArray.getBoolean(this.readFully(1));
    }

    readByte(): number {
        return ByteArray.getByte(this.readFully(1));
    }

    readUnsignedByte(): number {
        return ByteArray.getUnsignedByte(this.readFully(1));
    }

    readChar(): string {
        return ByteArray.getChar(this.readFully(2));
    }

    readShort(): number {
        return ByteArray.getShort(this.readFully(2));
    }

    readUnsignedShort(): number {
        return ByteArray.getUnsignedShort(this.readFully(2));
    }

    readInt(): number {
        return ByteArray.getInt(this.readFully(4));
    }

    readLong(): bigint {
        return ByteArray.getLong(this.readFully(8));
    }

    readFloat(): number {
        return ByteArray.getFloat(this.readFully(4));
    }

    readDouble(): number {
        return ByteArray.getDouble(this.readFully(8));
    }

    // https://docs.oracle.com/javase/8/docs/api/java/io/DataInput.html#readUTF--
    readUtf(): string {
        const length = this.readUnsignedShort();
        const bytes = this.readFully(length);

        const resultChars = new Uint16Array(bytes.length);
        let resultCharsOffset = 0;
        for (let i=0; i<bytes.length; resultCharsOffset++) {
            const a = bytes[i++];

            // Single-byte group
            if ((a & 0b1000_0000) === 0b0000_0000) {
                resultChars[resultCharsOffset] = a;
            }
            // Two-byte group
            else if ((a & 0b1110_0000) === 0b1100_0000) {
                if (i+1 > bytes.length) throw new UTFDataFormatException();
                const b = bytes[i++];
                if ((b & 0b1100_0000) !== 0b1000_0000) throw new UTFDataFormatException();
                resultChars[resultCharsOffset] = (((a & 0x1F) << 6) | (b & 0x3F));
            }
            // Three-byte group
            else if ((a & 0b1111_0000) === 0b1110_0000) {
                if (i+2 > bytes.length) throw new UTFDataFormatException();
                const b = bytes[i++];
                const c = bytes[i++];
                if ((b & 0b1100_0000) !== 0b1000_0000) throw new UTFDataFormatException();
                if ((c & 0b1100_0000) !== 0b1000_0000) throw new UTFDataFormatException();
                resultChars[resultCharsOffset] = (((a & 0x0F) << 12) | ((b & 0x3F) << 6) | (c & 0x3F));
            }
            //  Encoding error
            else {
                throw new UTFDataFormatException();
            }
        }

        return Array.from(resultChars.subarray(0, resultCharsOffset), String.fromCharCode).join("");
    }

    readObject(): any {
        switch (this.peekByte()) {
            case TC_OBJECT:
                throw new NotImplementedError();
                break;
            case TC_CLASS:
                throw new NotImplementedError();
                break;
            case TC_ARRAY:
                throw new NotImplementedError();
                break;
            case TC_STRING:
            case TC_LONGSTRING:
                throw new NotImplementedError();
                break;
            case TC_ENUM:
                throw new NotImplementedError();
                break;
            case TC_CLASSDESC:
            case TC_PROXYCLASSDESC:
                throw new NotImplementedError();
                break;
            case TC_REFERENCE:
                throw new NotImplementedError();
                break;
            case TC_NULL:
                throw new NotImplementedError();
                break;
            case TC_EXCEPTION:
                throw new NotImplementedError();
                break;
            default:
                throw new StreamCorruptedException();
        }
    }

    registerHandler<T, S>(className: string, handler: (ois: ObjectInputStream, initial: S, classDesc: ClassDesc) => T, initializer: () => S): void;
    registerHandler<T>(className: string, handler: (ois: ObjectInputStream, initial: {}, classDesc: ClassDesc) => T): void;
    registerHandler<T, S>(className: string, handler: (ois: ObjectInputStream, initial: S, classDesc: ClassDesc) => T, initializer?: () => S): void {

    }
}


class ByteArray {
    private static getIntegral(arr: Uint8Array, numBytes: number, signed: boolean): bigint {
        if (arr.length < numBytes) {
            throw new IndexOutOfBoundsException();
        }
        if (numBytes <= 0) {
            return 0n;
        }
        const bytes = arr.subarray(0, numBytes);
        let result = 0n;
        for (const byte of bytes) {
            result <<= 8n;
            result += BigInt(byte);
        }
        if (signed) {
            const signMask = 1 << 7;
            const signBit = numBytes > 0 && ((bytes[0] & signMask) !== 0);
            if (signBit) {
                const modulus = 1n << BigInt(numBytes * 8 - 1);
                result -= modulus;
            }
        }
        return result;
    }

    public static getBoolean(arr: Uint8Array): boolean {
        return arr[0] != 0;
    }

    public static getByte(arr: Uint8Array): number {
        return Number(this.getIntegral(arr, 1, true));
    }

    public static getUnsignedByte(arr: Uint8Array): number {
        return Number(this.getIntegral(arr, 1, false))
    }

    public static getChar(arr: Uint8Array): string {
        return String.fromCharCode(Number(this.getIntegral(arr, 2, false)));
    }

    public static getShort(arr: Uint8Array): number {
        return Number(this.getIntegral(arr, 2, true));
    }

    public static getUnsignedShort(arr: Uint8Array): number {
        return Number(this.getIntegral(arr, 2, false));
    }

    public static getInt(arr: Uint8Array): number {
        return Number(this.getIntegral(arr, 4, true));
    }

    public static getLong(arr: Uint8Array): bigint {
        return this.getIntegral(arr, 8, true);
    }

    public static getFloat(arr: Uint8Array): number {
        if (arr.length < 4) throw new IndexOutOfBoundsException();
        return new DataView(arr.subarray(0, 4).buffer).getFloat32(0, false);
    }

    public static getDouble(arr: Uint8Array): number {
        if (arr.length < 4) throw new IndexOutOfBoundsException();
        return new DataView(arr.subarray(0, 4).buffer).getFloat32(0, false);
    }
}

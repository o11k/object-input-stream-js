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


class ObjectStreamException extends Error {}
class StreamCorruptedException extends ObjectStreamException {}
class EOFException extends ObjectStreamException {}  // Not the same hierarchy as Java
class UTFDataFormatException extends ObjectStreamException {}    // Not the same hierarchy as Java

class NotImplementedError extends Error {}  // TODO remove before publishing

class ObjectInputStream {
    private data: Uint8Array;
    private offset: number;

    constructor(data: Uint8Array) {
        this.data = data;
        this.offset = 0;

        if (this.readShort() !== STREAM_MAGIC)   throw new StreamCorruptedException();
        if (this.readShort() !== STREAM_VERSION) throw new StreamCorruptedException();
    }

    eof(): boolean {
        return this.offset === this.data.length;
    }

    read(): number
    read(length: number): Uint8Array
    read(length?: number): number | Uint8Array {
        if (length === undefined) {
            if (this.eof()) return -1;
            return this.read(1)[0];
        }

        length = Math.min(length, this.data.length-this.offset);
        if (length < 0) throw new Error("Can't read a negative number of bytes");
        const result = this.data.slice(this.offset, this.offset + length);
        this.offset += length;
        return result
    }

    readFully(length: number): Uint8Array {
        const result = this.read(length);
        if (result.length < length) {
            throw new EOFException();
        }
        return result;
    }

    skipBytes(length: number): void {
        this.read(length);
    }

    private peekByte(): number {
        if (this.eof()) throw new EOFException();
        return this.data[this.offset];
    }

    private readIntegral(numBytes: number, signed: boolean): bigint {
        let result = 0n;
        const bytes = this.readFully(numBytes);
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

    readBoolean(): boolean {
        return this.readIntegral(1, false) !== 0n;
    }

    readByte(): number {
        return Number(this.readIntegral(1, true));
    }

    readUnsignedByte(): number {
        return Number(this.readIntegral(1, false));
    }

    readChar(): string {
        return String.fromCharCode(Number(this.readIntegral(1, false)));
    }

    readShort(): number {
        return Number(this.readIntegral(2, true));
    }

    readUnsignedShort(): number {
        return Number(this.readIntegral(2, false));
    }

    readInt(): number {
        return Number(this.readIntegral(4, true));
    }

    readLong(): bigint {
        return this.readIntegral(8, true);
    }

    readFloat(): number {
        return new DataView(this.readFully(4).buffer).getFloat32(0, false);
    }

    readDouble(): number {
        return new DataView(this.readFully(8).buffer).getFloat64(0, false);
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

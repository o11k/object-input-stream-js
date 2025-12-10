export const STREAM_MAGIC      = 0xaced;
export const STREAM_VERSION    = 5;

export const TC_NULL           = 0x70;
export const TC_REFERENCE      = 0x71;
export const TC_CLASSDESC      = 0x72;
export const TC_OBJECT         = 0x73;
export const TC_STRING         = 0x74;
export const TC_ARRAY          = 0x75;
export const TC_CLASS          = 0x76;
export const TC_BLOCKDATA      = 0x77;
export const TC_ENDBLOCKDATA   = 0x78;
export const TC_RESET          = 0x79;
export const TC_BLOCKDATALONG  = 0x7A;
export const TC_EXCEPTION      = 0x7B;
export const TC_LONGSTRING     = 0x7C;
export const TC_PROXYCLASSDESC = 0x7D;
export const TC_ENUM           = 0x7E;

export const baseWireHandle    = 0x7E0000;

export const SC_WRITE_METHOD   = 0x01;  // if SC_SERIALIZABLE
export const SC_BLOCK_DATA     = 0x08;  // if SC_EXTERNALIZABLE
export const SC_SERIALIZABLE   = 0x02;
export const SC_EXTERNALIZABLE = 0x04;
export const SC_ENUM           = 0x10;


export class JavaException extends Error {}
export class IOException extends JavaException {}
export class ObjectStreamException extends IOException {}
export class StreamCorruptedException extends ObjectStreamException {}
export class EOFException extends IOException {}
export class UTFDataFormatException extends IOException {}
export class RuntimeException extends JavaException {}
export class IllegalStateException extends RuntimeException {}
export class IndexOutOfBoundsException extends RuntimeException {}
export class OptionalDataException extends ObjectStreamException {}

export class NotImplementedError extends Error {}  // TODO remove before publishing

export const JAVAOBJ_SYMBOL = Symbol("javaobj");

export namespace J {
    export type Contents = Content[];
    export type Content = Object | BlockData;
    export type BlockData = Uint8Array;
    export type Object =
        ObjectInstance
      | Class
      | Array
      | String
      | Enum
      | ClassDesc
    //| PrevObject
      | null
    //| Exception
    export type Exception = Object

    export type ObjectInstance = {
        [JAVAOBJ_SYMBOL]: ObjectInstanceInternal,
        [key: string | number | symbol]: any,
    }

    export type ObjectInstanceInternal = {
        classDesc: ClassDesc | null,
        classData: Map<string, ClassData>
    }
    export type ClassData =
        {values: Values, annotation?: Contents}
      | {values?: Values, annotation: Contents}
    export type Values = Map<string, Object | Primitive>

    // TODO: unify with ClassDesc?
    export type Class = {
        type: "class"
        classDesc: ClassDesc | null,
    }

    export type Array = (Object | Primitive)[] & {
        [JAVAOBJ_SYMBOL]: {classDesc: ClassDesc | null}
    };

    export type Enum = {
        type: "enum",
        classDesc: ClassDesc | null,
        name: string,
    }

    export type ClassDesc = NonProxyClassDesc //| ProxyClassDesc
    export type NonProxyClassDesc = {
        type: "classDesc",
        proxy: false,
        className: string,
        serialVersionUID: bigint,
        flags: number,
        fields: FieldDesc[],
        annotation: Contents,
        super: ClassDesc | null,
    }
    //export type ProxyClassDesc = unknown  // TODO

    export type FieldDesc = PrimitiveDesc | ObjectDesc
    export type FieldTypecode = 'B' | 'C' | 'D' | 'F' | 'I' | 'J' | 'S' | 'Z' | '[' | 'L'
    export type PrimitiveDesc = {
        typecode: 'B' | 'C' | 'D' | 'F' | 'I' | 'J' | 'S' | 'Z',
        fieldName: string,
    }
    export type ObjectDesc = {
        typecode: 'L' | '[',
        fieldName: string,
        className: String,
    }
    export type Primitive = number | bigint | boolean | string //=char
    export type String = string
}

// Note: interface and class definitions are slightly different to Java

export abstract class ByteInput {
    abstract read1(): number;

    read(len: number): Uint8Array {
        len = Math.max(len, 0);
        const result = new Uint8Array(len);
        let i = 0;
        while (i < len) {
            const c = this.read1();
            if (c < 0) break;
            result[i++] = c;
        }
        return result.slice(0, i);
    }

    readFully(len: number): Uint8Array {
        const result = this.read(len);
        if (result.length < len) {
            throw new EOFException()
        }
        return result;
    }
}

export abstract class PrimitiveInput extends ByteInput {
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

    readUTF(): string {
        return this.readUTFBody(this.readUnsignedShort());
    }

    readLongUTF(): string {
        const length = this.readLong();
        if (length > Number.MAX_SAFE_INTEGER) {
            throw new NotImplementedError(`string longer than ${Number.MAX_SAFE_INTEGER} bytes`);
        }
        return this.readUTFBody(Number(length));
    }

    // https://docs.oracle.com/javase/8/docs/api/java/io/DataInput.html#readUTF--
    readUTFBody(length: number): string {
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

        return Array.from(resultChars.subarray(0, resultCharsOffset), c => String.fromCharCode(c)).join("");
    }
}

class HandleTable {
    private table: Map<number, J.Object>;
    private currHandle = baseWireHandle;

    constructor() {
        this.table = new Map();
    }

    reset(): void {
        this.table.clear();
        this.currHandle = baseWireHandle;
    }

    newHandle(obj: J.Object): number {
        const handle = this.currHandle++;
        this.table.set(handle, obj);
        return handle;
    }

    getObject(handle: number): J.Object {
        const result = this.table.get(handle);
        if (result === undefined) throw new StreamCorruptedException("Object handle doesn't exist: " + handle);
        return result;
    }
}

export class ObjectInputStreamParser extends PrimitiveInput {
    private data: Uint8Array;
    private offset: number;
    private handleTable: HandleTable;

    constructor(data: Uint8Array) {
        super();
        this.data = data;
        this.offset = 0;
        this.handleTable = new HandleTable();

        if (this.readUnsignedShort() !== STREAM_MAGIC) throw new StreamCorruptedException("Missing STREAM_MAGIC");
        if (this.readUnsignedShort() !== STREAM_VERSION) throw new StreamCorruptedException("Missing STREAM_VERSION");
    }

    read1(): number {
        if (this.eof())
            return -1;
        return this.data[this.offset++];
    }

    peek1(): number {
        if (this.eof())
            return -1;
        return this.data[this.offset];
    }

    eof(): boolean {
        return this.offset >= this.data.length;
    }

    public nextContent(): J.Content {
        let tc = this.peek1();

        // This is technically an "object" and not a "content", but in practice it doesn't matter
        while (tc === TC_RESET) {
            this.handleTable.reset();
            this.read1();
            tc = this.peek1();
        }

        if (tc === -1)
            throw new EOFException();

        switch (tc) {
            case TC_BLOCKDATA:
            case TC_BLOCKDATALONG:
                return this.parseBlockData();
            case TC_OBJECT:
            case TC_CLASS:
            case TC_ARRAY:
            case TC_STRING:
            case TC_ENUM:
            case TC_CLASSDESC:
            case TC_PROXYCLASSDESC:
            case TC_REFERENCE:
            case TC_NULL:
            case TC_EXCEPTION:
                return this.parseObject();
            default:
                throw new StreamCorruptedException("Unknown content tc: " + tc);
        }
    }

    protected parseContents(allowEndBlock=false): J.Contents {
        const result = [];
        while (!this.eof()) {
            const tc = this.peek1();
            if (tc === TC_ENDBLOCKDATA && allowEndBlock)
                break;

            try {
                result.push(this.nextContent());
            } catch (ex) {
                if (ex instanceof EOFException) {
                    break;
                } else {
                    throw ex;
                }
            }
        }
        return result;
    }

    protected parseBlockData(): J.BlockData {
        const tc = this.read1();
        let size: number;
        switch (tc) {
            case TC_BLOCKDATA:
                size = this.readUnsignedByte();
                break;
            case TC_BLOCKDATALONG:
                size = this.readInt();
                break;
            default:
                throw new StreamCorruptedException("Unknown block data tc: " + tc);
        }
        return this.readFully(size);
    }

    protected parseObject(): J.Object {
        const tc = this.peek1();
        switch (tc) {
            case TC_OBJECT:
                return this.parseNewObject();
            case TC_CLASS:
                return this.parseNewClass();
            case TC_ARRAY:
                return this.parseNewArray();
            case TC_STRING:
            case TC_LONGSTRING:
                return this.parseNewString();
            case TC_ENUM:
                return this.parseNewEnum();
            case TC_CLASSDESC:
            case TC_PROXYCLASSDESC:
                return this.parseNewClassDesc();
            case TC_REFERENCE:
                return this.parsePrevObject();
            case TC_NULL:
                this.read1();
                return null;
            case TC_EXCEPTION:
                return this.parseException();
            default:
                throw new StreamCorruptedException("Unknown object tc: " + tc);
        }
    }

    protected parseNewObject(): J.ObjectInstance {
        const tc = this.read1();
        if (tc !== TC_OBJECT) throw new StreamCorruptedException("Unknown new object tc: " + tc);
        const result: Partial<J.ObjectInstance> = {};
        const classDesc = this.parseClassDesc();
        const handle = this.handleTable.newHandle(result as J.ObjectInstance);

        const internal = this._parseObjectInternal(classDesc);
        // @ts-expect-error
        internal.handle = handle;

        for (const currData of internal.classData.values()) {
            for (const [fieldName, fieldValue] of currData.values ?? new Map() as J.Values) {
                result[fieldName] = fieldValue;
            }
        }
        return Object.assign(result, {[JAVAOBJ_SYMBOL]: internal})
    }

    private _parseObjectInternal(classDesc: J.ClassDesc | null): J.ObjectInstanceInternal {
        const result: Partial<J.ObjectInstanceInternal> = {};

        const classChain = [];
        let currClass = classDesc;
        while (currClass !== null) {
            classChain.push(currClass);
            currClass = currClass.super;
        }
        classChain.reverse();

        const classData = [];
        for (const classDesc of classChain) {
            let currData: J.ClassData;
            const flags = classDesc.flags;

            if ((SC_SERIALIZABLE & flags) && !(SC_WRITE_METHOD & flags)) {
                currData = {
                    values: this.parseValues(classDesc)
                };
            } else if ((SC_SERIALIZABLE & flags) && !(SC_WRITE_METHOD & flags)) {
                currData = {
                    values: this.parseValues(classDesc),
                    annotation: this.parseObjectAnnotation(),
                }
            } else if ((SC_EXTERNALIZABLE & flags) && !(SC_BLOCK_DATA & flags)) {
                throw new NotImplementedError("PROTOCOL_VERSION_1 Externalizable object");
            } else if ((SC_EXTERNALIZABLE & flags) && !(SC_BLOCK_DATA & flags)) {
                currData = {
                    annotation: this.parseObjectAnnotation(),
                }
            } else {
                throw new StreamCorruptedException("Unknown classDescFlags: " + flags);
            }
            classData.push(currData);
        }
        return Object.assign(result, {classDesc, classData});
    }

    protected parseValues(classDesc: J.ClassDesc): J.Values {
        const result: J.Values = new Map();
        for (const field of classDesc.fields) {
            result.set(field.fieldName, this.parseValue(field.typecode));
        }
        return result;
    }

    protected parseValue(typecode: string): J.Object | J.Primitive {
        switch (typecode) {
            case '[':
            case 'L':
                // TODO: type checking
                return this.parseObject();
            case 'B': return this.readByte();
            case 'C': return this.readChar();
            case 'D': return this.readDouble();
            case 'F': return this.readFloat();
            case 'I': return this.readInt();
            case 'J': return this.readLong();
            case 'S': return this.readShort();
            case 'Z': return this.readBoolean();
            default:
                throw new StreamCorruptedException("Unkown field value typecode: " + typecode);
        }
    }

    protected parseNewClass(): J.Class {
        const tc = this.read1();
        if (tc !== TC_CLASS) throw new StreamCorruptedException("Unknown reference tc: " + tc);

        const result: J.Class = {
            type: "class",
            classDesc: this.parseClassDesc(),
        };
        const handle = this.handleTable.newHandle(result);
        // @ts-expect-error
        result.handle = handle;
        return result;
    }

    protected parseNewArray(): J.Array {
        const tc = this.read1();
        if (tc !== TC_ARRAY) throw new StreamCorruptedException("Unknown array tc: " + tc);

        const result: (J.Object | J.Primitive)[] = [];
        const classDesc = this.parseClassDesc();
        if (classDesc === null || !classDesc.className.startsWith("["))
            throw new StreamCorruptedException("Array class name doesn't begin with [: " + classDesc!.className);
        const typecode = classDesc.className[1];
        const handle = this.handleTable.newHandle(result as J.Array);
        const size = this.readInt();
        for (let i=0; i<size; i++) {
            result.push(this.parseValue(typecode));
        }
        return Object.assign(result, {[JAVAOBJ_SYMBOL]: {
            classDesc,
            handle,
        }});
    }

    protected parseNewString(): J.String {
        const tc = this.read1();
        let result: string;
        switch (tc) {
            case TC_STRING:
                result = this.readUTF();
                break;
            case TC_LONGSTRING:
                result = this.readLongUTF();
                break;
            default:
                throw new StreamCorruptedException("Unknown string tc: " + tc);
        }
        this.handleTable.newHandle(result);
        return result;
    }

    protected parseNewEnum(): J.Enum {
        const tc = this.read1();
        if (tc !== TC_ENUM) throw new StreamCorruptedException("Unknown enum tc: " + tc);
        const result: Partial<J.Enum> = {};
        const classDesc = this.parseClassDesc();
        const handle = this.handleTable.newHandle(result as J.Enum)
        const name = this.parseObject();
        if (typeof name !== "string") {
            throw new StreamCorruptedException("Enum name must be a String object");
        }
        return Object.assign(result, {type: "enum", classDesc, name});
    }

    protected parseNewClassDesc(): J.ClassDesc {
        const tc = this.read1();
        if (tc === TC_PROXYCLASSDESC) throw new NotImplementedError("proxy classes");
        if (tc !== TC_CLASSDESC) throw new StreamCorruptedException("Unknown new class desc tc: " + tc);

        const result = {
            type: "classDesc" as "classDesc",
            proxy: false as false
        };
        const className = this.readUTF();
        const serialVersionUID = this.readLong();
        const handle = this.handleTable.newHandle(result as J.ClassDesc);
        const flags = this.readUnsignedByte();
        const fields = this.parseFields();
        const annotation = this.parseClassAnnotation();
        const super_ = this.parseClassDesc();
        return Object.assign(result, {
            className,
            serialVersionUID,
            handle,
            flags,
            fields,
            annotation,
            super: super_
        });
    }

    protected parseFields(): J.FieldDesc[] {
        const fields: J.FieldDesc[] = [];
        const fieldCount = this.readShort();
        for (let i=0; i<fieldCount; i++) {
            const typecode = String.fromCharCode(this.readUnsignedByte());
            const fieldName = this.readUTF();
            let field: J.FieldDesc;

            switch (typecode) {
                case '[': case 'L':
                    const className = this.parseObject();
                    if (typeof className !== "string")
                        throw new StreamCorruptedException("Field class name must be a String object");
                    field = {typecode, fieldName, className};
                    break;
                case 'B': case 'C': case 'D': case 'F': case 'I': case 'J': case 'S': case 'Z':
                    field = {typecode, fieldName};
                    break;
                default:
                    throw new StreamCorruptedException("Unkown field typecode: " + typecode);
            }
            fields.push(field);
        }
        return fields;
    }

    protected parseClassDesc(): J.ClassDesc | null {
        const tc = this.peek1();
        switch (tc) {
            case TC_CLASSDESC:
            case TC_PROXYCLASSDESC:
                return this.parseNewClassDesc();
            case TC_NULL:
                this.read1();
                return null;
            case TC_REFERENCE:
                // TODO: check that's it's a classdesc
                const obj = this.parsePrevObject();
                if (typeof obj !== "object" || obj === null || obj instanceof Array || obj.type !== "classDesc")
                    throw new StreamCorruptedException();
                // @ts-expect-error  TODO change types to classes
                return obj;
            default:
                throw new StreamCorruptedException("Unknown class desc tc: " + tc);
        }
    }

    protected parsePrevObject(): J.Object {
        const tc = this.read1();
        if (tc !== TC_REFERENCE) throw new StreamCorruptedException("Unknown reference tc: " + tc);
        const handle = this.readInt();
        return this.handleTable.getObject(handle);
    }

    protected parseException(): J.Exception {
        const tc = this.read1();
        if (tc !== TC_EXCEPTION) throw new StreamCorruptedException("Unknown exception tc: " + tc);
        throw new NotImplementedError("Exceptions in stream");
    }

    private _parseEndBlockTerminatedContents(): J.Contents {
        const contents = this.parseContents(true);
        const endBlock = this.read1();
        if (endBlock !== TC_ENDBLOCKDATA) throw new StreamCorruptedException("Expected TC_ENDBLOCKDATA");
        return contents;
    }

    protected parseObjectAnnotation(): J.Contents { return this._parseEndBlockTerminatedContents(); }
    protected parseClassAnnotation(): J.Contents { return this._parseEndBlockTerminatedContents(); }
}

const CONTENT_EOF = Symbol("content eof");


export class ObjectInputStream extends PrimitiveInput {
    private parser: ObjectInputStreamParser;
    private currContent: J.Content | typeof CONTENT_EOF;
    private blockOffset: number;

    constructor(data: Uint8Array) {
        super();
        this.parser = new ObjectInputStreamParser(data)

        this.currContent = null;
        this.blockOffset = 0;
        this.readNextContent();
    }

    protected readNextContent(): void {
        this.blockOffset = 0;
        try {
            this.currContent = this.parser.nextContent();
        } catch (ex) {
            if (ex instanceof EOFException) {
                this.currContent = CONTENT_EOF;
            } else {
                throw ex;
            }
        }

        // Skip empty blocks
        if (this.currContent instanceof Uint8Array && this.currContent.length === 0)
            return this.readNextContent();
    }

    read1() {
        if (this.currContent === CONTENT_EOF)
            return -1;

        if (!(this.currContent instanceof Uint8Array))
            return -1;

        if (this.blockOffset >= this.currContent.length)
            throw new IllegalStateException();

        const result = this.currContent[this.blockOffset++];

        if (this.blockOffset >= this.currContent.length)
            this.readNextContent();

        return result;
    }

    readObject(): J.Object {
        if (this.currContent === CONTENT_EOF)
            throw new EOFException();

        if (this.currContent instanceof Uint8Array)
            throw new OptionalDataException();

        const result = this.currContent;
        this.readNextContent();
        return result;
    }
}


export class ByteArray {
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
            const topBit = 1n << BigInt(numBytes * 8 - 1);
            if ((result & topBit) !== 0n) {
                result -= 1n << BigInt(numBytes * 8);
            }
        }
        return result;
    }

    public static getBoolean(arr: Uint8Array): boolean {
        if (arr.length < 1) throw new IndexOutOfBoundsException();
        return arr[0] !== 0;
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
        if (arr.length < 8) throw new IndexOutOfBoundsException();
        return new DataView(arr.subarray(0, 8).buffer).getFloat64(0, false);
    }
}

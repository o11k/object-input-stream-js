import {
    StreamCorruptedException,
    EOFException,
    UTFDataFormatException,
    IllegalStateException,
    IndexOutOfBoundsException,
    OptionalDataException,
    ClassNotFoundException,
    NotActiveException,
    NotImplementedError,
} from './exceptions';
import { builtinSerializables, builtinExternalizables } from './classes'

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

export namespace J {
    export type Contents = Content[];
    export type Content = Object | BlockData;
    export class BlockData extends Uint8Array {};
    export type Object =
        Serializable | Externalizable  // | any, because of readReplace
      | Class
      | Array
      | String
      | Enum
      | ClassDesc
    //| PrevObject
      | null
    //| Exception
    export type Exception = Object

    export class SerializableFallback implements Serializable {
        $classDesc: ClassDesc | null = null;
        [field: string]: any;
    }

    export class ExternalizableFallback implements Externalizable {
        classDesc: ClassDesc | null = null;
        annotations: Contents = [];

        readExternal(ois: ObjectInputStream, classDesc: J.ClassDesc): void {
            this.classDesc = classDesc;
            this.annotations = ois.readAllContents();
        }
    }

    export class Class {
        classDesc: ClassDesc | null = null;
    }

    export class Array extends globalThis.Array {
        classDesc: ClassDesc | null = null;
    }

    export class Enum {
        classDesc: ClassDesc | null = null;
        name: string = "";
    }

    export type Values = Map<string, Object | Primitive>

    export type ClassDesc = NonProxyClassDesc //| ProxyClassDesc;
    export class BaseClassDesc {}
    //export class ProxyClassDesc extends BaseClassDesc {}
    export class NonProxyClassDesc extends BaseClassDesc {
        className: string = "";
        serialVersionUID: bigint = -1n;
        flags: number = -1;
        fields: FieldDesc[] = [];
        annotations: Contents = [];
        super: ClassDesc | null = null;
    }

    export type FieldTypecode = PrimitiveTypecode | ObjectTypecode;
    export type PrimitiveTypecode = 'B' | 'C' | 'D' | 'F' | 'I' | 'J' | 'S' | 'Z';
    export type ObjectTypecode = '[' | 'L';

    export type FieldDesc = PrimitiveDesc | ObjectDesc
    export type PrimitiveDesc = {
        typecode: PrimitiveTypecode,
        fieldName: string,
    }
    export type ObjectDesc = {
        typecode: ObjectTypecode,
        fieldName: string,
        className: String,
    }

    export type Primitive = byte | char | double | float | int | long | short | bool;
    export type byte = number;
    export type char = string;
    export type double = number;
    export type float = number;
    export type int = number;
    export type long = bigint;
    export type short = number;
    export type bool = boolean;

    export type String = string
}

// Note: interface and class definitions are slightly different to Java

export interface Serializable {
    readObject?(ois: ObjectInputStream, classDesc: J.ClassDesc): void
    readResolve?(): any
    serialVersionUID?: bigint
    [key: string | symbol]: any  // To prevent ts(2559)
}

export interface Externalizable {
    readExternal(ois: ObjectInputStream, classDesc: J.ClassDesc): void
    readResolve?(): any
}

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
    readBoolean(): J.bool {
        return ByteArray.getBoolean(this.readFully(1));
    }

    readByte(): J.byte {
        return ByteArray.getByte(this.readFully(1));
    }

    readUnsignedByte(): J.int {
        return ByteArray.getUnsignedByte(this.readFully(1));
    }

    readChar(): J.char {
        return ByteArray.getChar(this.readFully(2));
    }

    readShort(): J.short {
        return ByteArray.getShort(this.readFully(2));
    }

    readUnsignedShort(): J.int {
        return ByteArray.getUnsignedShort(this.readFully(2));
    }

    readInt(): J.int {
        return ByteArray.getInt(this.readFully(4));
    }

    readLong(): J.long {
        return ByteArray.getLong(this.readFully(8));
    }

    readFloat(): J.float {
        return ByteArray.getFloat(this.readFully(4));
    }

    readDouble(): J.double {
        return ByteArray.getDouble(this.readFully(8));
    }

    readUTF(): J.String {
        return this.readUTFBody(this.readUnsignedShort());
    }

    readLongUTF(): J.String {
        const length = this.readLong();
        if (length > Number.MAX_SAFE_INTEGER) {
            throw new NotImplementedError("string longer than Number.MAX_SAFE_INTEGER bytes");
        }
        return this.readUTFBody(Number(length));
    }

    // https://docs.oracle.com/javase/8/docs/api/java/io/DataInput.html#readUTF--
    readUTFBody(byteLength: number): J.String {
        const bytes = this.readFully(byteLength);

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
            // Encoding error
            else {
                throw new UTFDataFormatException();
            }
        }

        return Array.from(resultChars.subarray(0, resultCharsOffset), c => String.fromCharCode(c)).join("");
    }
}

class HandleTable {
    private table: Map<number, J.Object> = new Map();
    private currHandle = baseWireHandle;

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
        if (!this.table.has(handle))
            throw new StreamCorruptedException("Object handle doesn't exist: " + handle);
        return this.table.get(handle)!;
    }

    replaceObject(handle: number, oldObj: J.Object, newObj: J.Object): void {
        if (this.table.get(handle) !== oldObj)
            throw new Error(`Replaced handle ${handle} doesn't refer to object ${oldObj}`);

        this.table.set(handle, newObj);
    }
}

export class ObjectInputStreamParser extends PrimitiveInput {
    private data: Uint8Array;
    private offset = 0;
    private handleTable = new HandleTable();
    private serializableClasses = new Map<string, new () => Serializable>();
    private externalizableClasses = new Map<string, new () => Externalizable>();
    private contextStack: {
        classDesc: J.ClassDesc,
        object: Serializable | Externalizable,
        alreadyReadFields: boolean
    }[] = [];

    constructor(data: Uint8Array) {
        super();
        this.data = data;

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

    public nextContent(endBlockEOF=false): J.Content {
        // Automatically in endBlockEOF mode if inside the annotations of a Serializable object or a PROTOCOL_VERSION_2 Externalizable object
        if (this.contextStack.length > 0) {
            const context = this.contextStack[this.contextStack.length-1];
            const flags = context.classDesc.flags;
            if (((flags & SC_SERIALIZABLE) && (flags & SC_WRITE_METHOD)) ||
                ((flags & SC_EXTERNALIZABLE) && (flags & SC_BLOCK_DATA)))
                endBlockEOF = true;
        }

        let tc = this.peek1();

        // TC_RESET is technically an "object" and not a "content", but in practice it doesn't matter
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
            case TC_LONGSTRING:
            case TC_ENUM:
            case TC_CLASSDESC:
            case TC_PROXYCLASSDESC:
            case TC_REFERENCE:
            case TC_NULL:
            case TC_EXCEPTION:
                return this.parseObject();
            case TC_ENDBLOCKDATA:
                if (endBlockEOF) throw new EOFException();
            default:
                throw new StreamCorruptedException("Unknown content tc: " + tc);
        }
    }

    public parseContents(endBlockEOF=false): J.Contents {
        const result = [];
        while (!this.eof()) {
            try {
                result.push(this.nextContent(endBlockEOF));
            } catch (ex) {
                if (ex instanceof EOFException)
                    break;
                else
                    throw ex;
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
        return new J.BlockData(this.readFully(size));
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

    private _getClassDescHierarchy(classDesc: J.ClassDesc): J.ClassDesc[] {
        const hierarchy = [];
        let currClass: J.ClassDesc | null = classDesc;
        while (currClass !== null) {
            hierarchy.push(currClass);
            currClass = currClass.super;
        }
        return hierarchy.reverse();
    }

    protected parseNewObject(): Serializable | Externalizable {
        const tc = this.read1();
        if (tc !== TC_OBJECT) throw new StreamCorruptedException("Unknown new object tc: " + tc);

        // The docs say an object gets a handle before parsing its classDesc, but the implementation says otherwise
        const classDesc = this.parseClassDesc();
        if (classDesc === null) throw new StreamCorruptedException("Null classDesc");

        if (classDesc.flags & SC_EXTERNALIZABLE) {
            return this.parseExternalizable(classDesc);
        } else if (classDesc.flags & SC_SERIALIZABLE) {
            return this.parseSerializable(classDesc);
        } else {
            throw new StreamCorruptedException("classDesc for " + classDesc.className + " not serializable and not externalizable");
        }
    }

    protected parseExternalizable(classDesc: J.ClassDesc): Externalizable {
        // Resolve object constructor
        let Ctor = this.externalizableClasses.get(classDesc.className);
        if (Ctor === undefined) {
            if (classDesc.flags & SC_BLOCK_DATA) {
                Ctor = J.ExternalizableFallback;
            } else {
                throw new ClassNotFoundException("Cannot deserialize instance of Externalizable class " + classDesc.className + " written using PROTOCOL_VERSION_1, without a matching JS-side class");
            }
        }

        // Create object
        const result = new Ctor();
        const handle = this.handleTable.newHandle(result);

        // Call readExternal
        this.contextStack.push({classDesc, object: result, alreadyReadFields: false});
        const subOis = new ObjectInputStream(this);
        result.readExternal(subOis, classDesc);
        if (classDesc.flags & SC_BLOCK_DATA) {
            subOis.readAllContents();  // Skip unread annotations
            this._expectEndBlock();
        }
        this.contextStack.pop();

        // Replace result if applicable
        if (result.readResolve !== undefined) {
            const replaced = result.readResolve();
            this.handleTable.replaceObject(handle, result, replaced);
            return replaced;
        }

        return result;
    }

    private _expectEndBlock() {
        const tc = this.read1();
        if (tc === -1) throw new EOFException("Expected TC_ENDBLOCKDATA");
        if (tc !== TC_ENDBLOCKDATA) throw new StreamCorruptedException("Expected TC_ENDBLOCKDATA");
    }

    protected parseSerializable(classDesc: J.ClassDesc): Serializable {
        // Resolve object constructor
        const Ctor: new () => Serializable = this.serializableClasses.get(classDesc.className) ?? J.SerializableFallback;

        // Create object
        const result = new Ctor();
        const handle = this.handleTable.newHandle(result);

        if (result instanceof J.SerializableFallback) {
            result.$handle = handle;
            result.$classDesc = classDesc;
        }

        // Call readObject methods
        const classDescs = this._getClassDescHierarchy(classDesc);
        for (const currDesc of classDescs) {
            // Resolve readObject method
            // Defaults to defaultReadObject if classDesc's SC_WRITE_METHOD flag isn't set, or if class isn't registered in JS, or if JS class doesn't have a readObject method
            let readObjectMethod: NonNullable<Serializable["readObject"]> | null = null;
            if (currDesc.flags & SC_WRITE_METHOD) {
                const currCtor = this.serializableClasses.get(currDesc.className);
                if (currCtor !== undefined && !(result instanceof currCtor)) {
                    throw new Error(`Serializable class ${currDesc.className} is a superclass of ${classDesc.className} in Java, but not in JS`);
                }
                if (currCtor !== undefined && Object.prototype.hasOwnProperty.call(currCtor.prototype, "readObject")) {
                    readObjectMethod = currCtor.prototype.readObject;
                }
            }

            // Call readObject method
            this.contextStack.push({classDesc: currDesc, object: result, alreadyReadFields: false});
            const subOis = new ObjectInputStream(this);
            if (readObjectMethod !== null) {
                readObjectMethod.call(result, subOis, currDesc);
            } else {
                subOis.defaultReadObject();
            }
            if (currDesc.flags & SC_WRITE_METHOD) {
                subOis.readAllContents();  // Skip unread annotations
                this._expectEndBlock();
            }
            this.contextStack.pop();
        }

        // Replace result if applicable
        if (result.readResolve !== undefined) {
            const replaced = result.readResolve();
            this.handleTable.replaceObject(handle, result, replaced);
            return replaced;
        }

        return result;
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

        const result = new J.Class();
        result.classDesc = this.parseClassDesc();
        const handle = this.handleTable.newHandle(result);
        // @ts-expect-error
        result.handle = handle;
        return result;
    }

    protected parseNewArray(): J.Array {
        const tc = this.read1();
        if (tc !== TC_ARRAY) throw new StreamCorruptedException("Unknown array tc: " + tc);

        const result = new J.Array();
        const classDesc = this.parseClassDesc();
        result.classDesc = classDesc;

        if (classDesc === null || !classDesc.className.startsWith("["))
            throw new StreamCorruptedException("Array class name doesn't begin with [: " + classDesc!.className);
        const typecode = classDesc.className[1];

        const handle = this.handleTable.newHandle(result);
        // @ts-expect-error
        result.handle = handle;

        const size = this.readInt();
        for (let i=0; i<size; i++) {
            result.push(this.parseValue(typecode));
        }
        return result;
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
        const result = new J.Enum();
        result.classDesc = this.parseClassDesc();
        const handle = this.handleTable.newHandle(result as J.Enum)
        // @ts-expect-error
        result.handle = handle;
        const name = this.parseObject();
        if (typeof name !== "string") {
            throw new StreamCorruptedException("Enum name must be a String object");
        }
        result.name = name;
        
        return result;
    }

    protected parseNewClassDesc(): J.ClassDesc {
        const tc = this.read1();
        if (tc === TC_PROXYCLASSDESC) throw new NotImplementedError("proxy class");
        if (tc !== TC_CLASSDESC) throw new StreamCorruptedException("Unknown new class desc tc: " + tc);

        const result = new J.NonProxyClassDesc();
        result.className = this.readUTF();
        result.serialVersionUID = this.readLong();
        const handle = this.handleTable.newHandle(result);
        // @ts-expect-error
        result.handle = handle;
        result.flags = this.readUnsignedByte();
        result.fields = this.parseFields();
        result.annotations = this.parseClassAnnotation();
        result.super = this.parseClassDesc();

        return result;
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
                const obj = this.parsePrevObject();
                if (!(obj instanceof J.BaseClassDesc))
                    throw new StreamCorruptedException("Invalid classDesc reference");
                if (!(obj instanceof J.NonProxyClassDesc))
                    throw new NotImplementedError("proxy class");
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
        throw new NotImplementedError("Exception in stream");
    }

    private _parseEndBlockTerminatedContents(): J.Contents {
        const contents = this.parseContents(true);
        this._expectEndBlock();
        return contents;
    }

    protected parseObjectAnnotation(): J.Contents { return this._parseEndBlockTerminatedContents(); }
    protected parseClassAnnotation(): J.Contents { return this._parseEndBlockTerminatedContents(); }

    public registerSerializable(name: string, clazz: new () => Serializable): void {
        this.serializableClasses.set(name, clazz)
    }
    public registerExternalizable(name: string, clazz: new () => Externalizable): void {
        this.externalizableClasses.set(name, clazz)
    }

    public readFields(): J.Values {
        if (this.contextStack.length === 0) throw new NotActiveException("Not inside a readObject method");
        const context = this.contextStack[this.contextStack.length - 1];
        if (context.alreadyReadFields) throw new NotActiveException("Fields already read");
        if (!(context.classDesc.flags & SC_SERIALIZABLE)) throw new NotActiveException("Object not serializable");

        context.alreadyReadFields = true;
        return this.parseValues(context.classDesc);
    }

    public defaultReadObject(): void {
        const fields = this.readFields();
        const context = this.contextStack[this.contextStack.length-1];
        const obj = context.object as Serializable;

        for (const [name, value] of fields) {
            obj[name] = value;
        }
    }
}

const NO_CONTENT = Symbol("no content");

export class ObjectInputStream extends PrimitiveInput {
    private parser: ObjectInputStreamParser;
    private currBlock: J.BlockData | null = null;
    private blockOffset: number = 0;

    private nextContent: J.Content | typeof NO_CONTENT = NO_CONTENT;

    constructor(data: Uint8Array | ObjectInputStreamParser, options?: {
        initialSerializables?: Map<string, new () => Serializable>,
        initialExternalizables?: Map<string, new () => Externalizable>,
    }) {
        super();
        this.parser = data instanceof ObjectInputStreamParser ? data : new ObjectInputStreamParser(data)

        if (!(data instanceof ObjectInputStreamParser)) {
            const initialSerializables = options?.initialSerializables ?? builtinSerializables;
            for (const [k,v] of initialSerializables.entries()) this.registerSerializable(k, v);
            const initialExternalizables = options?.initialExternalizables ?? builtinExternalizables;
            for (const [k,v] of initialExternalizables.entries()) this.registerExternalizable(k, v);
        }
    }

    protected readNextContent(): J.Content {
        if (this.nextContent !== NO_CONTENT) {
            const result = this.nextContent;
            this.nextContent = NO_CONTENT;
            return result;
        }

        let content = this.parser.nextContent();

        // Skip empty blocks
        while ((content instanceof J.BlockData) && content.length === 0)
            content = this.parser.nextContent();

        return content;
    }

    read1() {
        // Ensure you're inside a block
        if (this.currBlock === null) {
            const content = this.readNextContent();
            if (!(content instanceof J.BlockData)) {
                this.nextContent = content;
                return -1;
            }

            this.currBlock = content;
            this.blockOffset = 0;
        }

        if (this.blockOffset >= this.currBlock.length)
            throw new Error("blockOffset >= currBlock.length");

        const result = this.currBlock[this.blockOffset++];

        if (this.blockOffset >= this.currBlock.length) {
            this.currBlock = null;
            this.blockOffset = 0;
        }

        return result;
    }

    readObject(): J.Object {
        if (this.currBlock !== null)
            throw new OptionalDataException();

        const content = this.readNextContent();
        if (content instanceof J.BlockData) {
            this.nextContent = content;
            throw new OptionalDataException();
        }

        return content;
    }

    public registerSerializable(name: string, clazz: new () => Serializable): void {
        this.parser.registerSerializable(name, clazz);
    }
    public registerExternalizable(name: string, clazz: new () => Externalizable): void {
        this.parser.registerExternalizable(name, clazz);
    }

    public readFields(): J.Values {
        if (this.currBlock !== null)
            throw new IllegalStateException("unread block data")
        return this.parser.readFields();
    }

    public defaultReadObject(): void {
        if (this.currBlock !== null)
            throw new IllegalStateException("unread block data")
        this.parser.defaultReadObject();
    }

    public readAllContents(): J.Contents {
        const result: J.Contents = [];

        if (this.currBlock !== null) {
            result.push(this.currBlock.slice(this.blockOffset));
            this.currBlock = null;
            this.blockOffset = 0;
        }

        result.push(...this.parser.parseContents())
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

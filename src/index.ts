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
export class InvalidClassException extends ObjectStreamException {}
export class ReflectiveOperationException extends JavaException {}
export class ClassNotFoundException extends ReflectiveOperationException {}
export class NotActiveException extends ObjectStreamException {}
export class InvalidObjectException extends ObjectStreamException {}

export class NotImplementedError extends Error {}  // TODO remove before publishing

export const JAVAOBJ_SYMBOL = Symbol("javaobj");

export namespace J {
    export type Contents = Content[];
    export type Content = Object | BlockData;
    export type BlockData = Uint8Array;
    export type Object =
        Serializable | Externalizable
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
        $classDesc: ClassDesc | null = null;
        annotations: Contents = [];

        readExternal(ois: ObjectInputStream, classDesc: J.ClassDesc): void {
            this.$classDesc = classDesc;
            this.annotations = ois.readAllContents();
        }
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
    private handle2obj: Map<number, J.Object> = new Map();
    // Primitives can end up having multiple handles
    private obj2handles: Map<J.Object, number[]> = new Map();
    private currHandle = baseWireHandle;

    reset(): void {
        this.handle2obj.clear();
        this.obj2handles.clear();
        this.currHandle = baseWireHandle;
    }

    newHandle(obj: J.Object): number {
        const handle = this.currHandle++;
        const handles = this.obj2handles.get(obj) ?? [];
        handles.push(handle);
        this.handle2obj.set(handle, obj);
        this.obj2handles.set(obj, handles);
        return handle;
    }

    getObject(handle: number): J.Object {
        const result = this.handle2obj.get(handle);
        if (result === undefined) throw new StreamCorruptedException("Object handle doesn't exist: " + handle);
        return result;
    }

    replaceObject(oldObj: J.Object, newObj: J.Object): void {
        const handles = this.obj2handles.get(oldObj);
        if (handles === undefined || handles.length === 0)
            throw new Error("Object to replace doesn't have a handle: " + oldObj);
        if (handles.length > 1)
            throw new Error("Object to replace has multiple handles: " + oldObj);
        const handle = handles[0];
        this.handle2obj.set(handle, newObj);
        this.obj2handles.delete(oldObj);
        this.obj2handles.set(newObj, handles);
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
        if (this.contextStack.length > 0) {
            const flags = this.contextStack[this.contextStack.length-1].classDesc.flags;
            if (((flags & SC_SERIALIZABLE) && (flags & SC_WRITE_METHOD)) ||
                ((flags & SC_EXTERNALIZABLE) && (flags & SC_BLOCK_DATA)))
                endBlockEOF = true;
        }

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
            case TC_ENDBLOCKDATA:
                if (endBlockEOF) throw new EOFException();
            default:
                throw new StreamCorruptedException("Unknown content tc: " + tc);
        }
    }

    public parseContents(endBlockEOF=false): J.Contents {
        const result = [];
        while (true) {
            try {
                result.push(this.nextContent(endBlockEOF));
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
        this.handleTable.newHandle(result);

        // Call readExternal
        this.contextStack.push({classDesc, object: result, alreadyReadFields: false});
        const subOis = new ObjectInputStream(this);
        result.readExternal(subOis, classDesc);
        if (classDesc.flags & SC_BLOCK_DATA) {
            subOis.readAllContents();  // Skip unread annotations
            if (this.read1() !== TC_ENDBLOCKDATA) throw new StreamCorruptedException("Expected TC_ENDBLOCKDATA");
        }
        this.contextStack.pop();

        // Replace result if applicable
        if (result.readResolve !== undefined) {
            const replaced = result.readResolve();
            this.handleTable.replaceObject(result, replaced);
            return replaced;
        }

        return result;
    }

    protected parseSerializable(classDesc: J.ClassDesc): Serializable {
        // Resolve object constructor
        const Ctor: new () => Serializable = this.serializableClasses.get(classDesc.className) ?? J.SerializableFallback;

        // Create object
        const result = new Ctor();
        this.handleTable.newHandle(result);

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
                if (this.read1() !== TC_ENDBLOCKDATA) throw new StreamCorruptedException("Expected TC_ENDBLOCKDATA");
            }
            this.contextStack.pop();
        }

        if (Ctor === J.SerializableFallback)
            (result as J.SerializableFallback).$classDesc = classDesc;

        // Replace result if applicable
        if (result.readResolve !== undefined) {
            const replaced = result.readResolve();
            this.handleTable.replaceObject(result, replaced);
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
                const obj = this.parsePrevObject() as J.ClassDesc;
                if (typeof obj !== "object" || obj === null || obj instanceof Array || obj.type !== "classDesc")
                    throw new StreamCorruptedException();
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

    public registerSerializable(name: string, clazz: new () => Serializable): void {
        this.serializableClasses.set(name, clazz)
    }
    public registerExternalizable(name: string, clazz: new () => Externalizable): void {
        this.externalizableClasses.set(name, clazz)
    }

    public readFields(): J.Values {
        if (this.contextStack.length === 0) throw new NotActiveException("Not inside a readObject method");
        const context = this.contextStack[this.contextStack.length - 1];
        if (context.alreadyReadFields) throw new NotActiveException("FIelds already read");
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
const CONTENT_EOF = Symbol("content eof");

export class ObjectInputStream extends PrimitiveInput {
    private parser: ObjectInputStreamParser;
    private currBlock: Uint8Array | null = null;
    private blockOffset: number = 0;

    private nextContent: J.Content | typeof NO_CONTENT = NO_CONTENT;

    constructor(data: Uint8Array | ObjectInputStreamParser) {
        super();
        this.parser = data instanceof ObjectInputStreamParser ? data : new ObjectInputStreamParser(data)
    }

    protected readNextContent(): J.Content {
        if (this.nextContent !== NO_CONTENT) {
            const result = this.nextContent;
            this.nextContent = NO_CONTENT;
            return result;
        }

        return this.parser.nextContent();
    }

    read1() {
        // Ensure you're inside a block
        while (this.currBlock === null) {
            let content = this.readNextContent();
            if (!(content instanceof Uint8Array)) {
                this.nextContent = content;
                return -1;
            }

            // Skip empty blocks
            if (content.length === 0) continue;

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
        // TODO readResolve can return a Uint8Array / Serializable classes can descend from it
        if (content instanceof Uint8Array) {
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

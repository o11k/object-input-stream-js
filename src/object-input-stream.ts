import * as exc from './exceptions';
import { builtinSerializables, builtinExternalizables, builtinEnums, builtinClasses } from './classes';

export type OisOptions = {
    initialClasses?: {
        serializable?: Map<string, SerializableCtor>,
        externalizable?: Map<string, ExternalizableCtor>,
        enum?: Map<string, Enum>,
        general?: Map<string, any>,
    }
}

export class ObjectInputStream {
    // ========== CONSTANTS ==========
    readonly baseWireHandle     = 0x7E0000;
    readonly PROTOCOL_VERSION_1 = 1;
    readonly PROTOCOL_VERSION_2 = 2;
    readonly STREAM_MAGIC       = 0xACED;
    readonly STREAM_VERSION     = 0x0005;
    readonly SC_WRITE_METHOD    = 0x01;
    readonly SC_BLOCK_DATA      = 0x08;
    readonly SC_SERIALIZABLE    = 0x02;
    readonly SC_EXTERNALIZABLE  = 0x04;
    readonly SC_ENUM            = 0x10;
    readonly TC_BASE            = 0x70;
    readonly TC_MAX             = 0x7E;
    readonly TC_NULL            = 0x70;
    readonly TC_REFERENCE       = 0x71;
    readonly TC_CLASSDESC       = 0x72;
    readonly TC_OBJECT          = 0x73;
    readonly TC_STRING          = 0x74;
    readonly TC_ARRAY           = 0x75;
    readonly TC_CLASS           = 0x76;
    readonly TC_BLOCKDATA       = 0x77;
    readonly TC_ENDBLOCKDATA    = 0x78;
    readonly TC_RESET           = 0x79;
    readonly TC_BLOCKDATALONG   = 0x7A;
    readonly TC_EXCEPTION       = 0x7B;
    readonly TC_LONGSTRING      = 0x7C;
    readonly TC_PROXYCLASSDESC  = 0x7D;
    readonly TC_ENUM            = 0x7E;

    static readonly baseWireHandle     = 0x7E0000;
    static readonly PROTOCOL_VERSION_1 = 1;
    static readonly PROTOCOL_VERSION_2 = 2;
    static readonly STREAM_MAGIC       = 0xACED;
    static readonly STREAM_VERSION     = 0x0005;
    static readonly SC_WRITE_METHOD    = 0x01;
    static readonly SC_BLOCK_DATA      = 0x08;
    static readonly SC_SERIALIZABLE    = 0x02;
    static readonly SC_EXTERNALIZABLE  = 0x04;
    static readonly SC_ENUM            = 0x10;
    static readonly TC_BASE            = 0x70;
    static readonly TC_MAX             = 0x7E;
    static readonly TC_NULL            = 0x70;
    static readonly TC_REFERENCE       = 0x71;
    static readonly TC_CLASSDESC       = 0x72;
    static readonly TC_OBJECT          = 0x73;
    static readonly TC_STRING          = 0x74;
    static readonly TC_ARRAY           = 0x75;
    static readonly TC_CLASS           = 0x76;
    static readonly TC_BLOCKDATA       = 0x77;
    static readonly TC_ENDBLOCKDATA    = 0x78;
    static readonly TC_RESET           = 0x79;
    static readonly TC_BLOCKDATALONG   = 0x7A;
    static readonly TC_EXCEPTION       = 0x7B;
    static readonly TC_LONGSTRING      = 0x7C;
    static readonly TC_PROXYCLASSDESC  = 0x7D;
    static readonly TC_ENUM            = 0x7E;

    // Full raw stream bytes
    protected data: Uint8Array;
    // Current position in this.data
    protected offset: number;
    // If false, byte and primitive read methods read directly from the raw stream.
    // If true, they read from block data: handle block boundaries and EOF if next element is not a block.
    protected blockDataMode: boolean;
    // Bytes remaining in the current block. -1 if blockDataMode=false
    protected remainingInBlock: number;
    // Handle table for back-references (prevObject, TC_REFERENCE)
    protected handleTable: HandleTable;
    // Classes registered by the user
    protected registeredClasses: Map<string, [ClassType, any]>;
    // Cache of proxy classes
    protected proxyClasses: Map<string, typeof BaseProxy>;
    // Context if inside a readObject method. Null otherwise
    protected curContext: CallbackContext | null;

    constructor(data: Uint8Array, options?: OisOptions) {
        this.data = data;
        this.offset = 0;
        this.blockDataMode = false;
        this.remainingInBlock = -1;
        this.handleTable = new HandleTable();
        this.registeredClasses = new Map();
        this.proxyClasses = new Map();
        this.curContext = null;

        if (this.readUnsignedShort() !== this.STREAM_MAGIC)
            throw new exc.StreamCorruptedException("Missing STREAM_MAGIC");
        if (this.readUnsignedShort() !== this.STREAM_VERSION)
            throw new exc.StreamCorruptedException("Missing STREAM_VERSION");
        this.setBlockDataMode(true);

        const initialSerializables = options?.initialClasses?.serializable ?? builtinSerializables;
        const initialExternalizables = options?.initialClasses?.externalizable ?? builtinExternalizables;
        const initialEnums = options?.initialClasses?.enum ?? builtinEnums;
        const initialClasses = options?.initialClasses?.general ?? builtinClasses;

        for (const [name, ctor] of initialSerializables)
            this.registerSerializable(name, ctor);
        for (const [name, ctor] of initialExternalizables)
            this.registerExternalizable(name, ctor);
        for (const [name, enum_] of initialEnums)
            this.registerEnum(name, enum_);
        for (const [name, ctor] of initialClasses)
            this.registerClass(name, ctor);
    }

    // ========== PROTECTED BYTE READ METHODS ==========
    protected setBlockDataMode(newMode: boolean): boolean {
        if (this.blockDataMode === newMode) {
            return this.blockDataMode;
        }
        this.remainingInBlock = newMode ? 0 : -1;
        if (!newMode && this.remainingInBlock > 0) {
            throw new exc.IllegalStateException("unread block data");
        }

        this.blockDataMode = newMode;
        return !this.blockDataMode;
    }
    protected peek1(): number {
        if (!this.blockDataMode)
            return (this.offset < this.data.length) ? this.data[this.offset] : -1;

        if (this.remainingInBlock === 0)
            this.refillBlockData();
        if (this.remainingInBlock > 0) {
            this.remainingInBlock;
            return this.data[this.offset];
        } else {
            return -1;
        }
    }
    protected peekByte(): number {
        const result = this.peek1();
        if (result < 0)
            throw new exc.EOFException();
        return result >= 128 ? result - 256 : result;
    }
    protected readBlockHeader(): number {
        if (!this.blockDataMode)
            throw new exc.IllegalStateException("readBlockHeader in normal mode");

        if (this.curContext?.defaultEndData)
            // Fix for 4360508
            return -1;

        const oldMode = this.setBlockDataMode(false);

        try {
            let tc;
            while ((tc = this.peek1()) === this.TC_RESET)
                this.readReset();

            switch (tc) {
                case this.TC_BLOCKDATA:
                    this.readTC();
                    return this.readUnsignedByte();

                case this.TC_BLOCKDATALONG:
                    this.readTC();
                    const len = this.readInt();
                    if (len < 0)
                        throw new exc.StreamCorruptedException("illegal block data header length: " + len);
                    return len;

                default:
                    if (tc >= 0 && (tc < this.TC_BASE || tc > this.TC_MAX))
                        throw new exc.StreamCorruptedException("invalid block type code: " + tcHex(tc));
                    return -1;
            }
        }
        finally {
            this.setBlockDataMode(oldMode);
        }
    }
    protected refillBlockData(): void {
        if (!this.blockDataMode)
            throw new exc.IllegalStateException("refill in normal mode");
        if (this.remainingInBlock > 0)
            return;

        // Skip empty blocks (OpenJDK doesn't do that)
        while (true) {
            const len = this.readBlockHeader();
            if (len < 0)
                return;
            if (len > 0){
                this.remainingInBlock = len;
                if (this.data.length - this.offset < len) {
                    throw new exc.StreamCorruptedException("unexpected EOF in middle of data block")
                }
                return;
            }
        }
    }

    // ========== BYTE READ METHODS ==========
    read1(): number {
        if (!this.blockDataMode)
            return (this.offset < this.data.length) ? this.data[this.offset++] : -1;

        if (this.remainingInBlock === 0)
            this.refillBlockData();
        if (this.remainingInBlock > 0) {
            this.remainingInBlock--;
            return this.data[this.offset++];
        } else {
            return -1;
        }
    }

    read(len: number): Uint8Array {
        len = Math.max(len, 0);
        len = Math.min(len, this.data.length - this.offset);

        if (!this.blockDataMode) {
            const result = new Uint8Array(this.data.slice(this.offset, this.offset + len));
            this.offset += len;
            return result;
        }

        const blocks: Uint8Array[] = [];

        let left = len;
        while (left > 0 && this.peek1() >= 0) {
            const toRead = Math.min(left, this.remainingInBlock);
            const block = this.data.subarray(this.offset, this.offset + toRead);
            this.offset += toRead;
            this.remainingInBlock -= toRead;
            left -= toRead;

            blocks.push(block);
        }

        const result = new Uint8Array(blocks.reduce((sum, cur) => sum + cur.length, 0));
        let offset = 0;
        for (const block of blocks) {
            result.set(block, offset);
            offset += block.length;
        }
        if (offset !== result.length)
            throw new exc.InternalError();

        return result;
    }

    readFully(len: number): Uint8Array {
        const result = this.read(len);
        if (result.length < len)
            throw new exc.EOFException();
        return result;
    }

    // ========== PROTECTED PRIMITIVE READ METHODS ==========
    protected readLongUTF(): string {
        const length = this.readLong();
        if (length > Number.MAX_SAFE_INTEGER) {
            throw new exc.NotImplementedError("string longer than Number.MAX_SAFE_INTEGER bytes");
        }
        return this.readUTFBody(Number(length));
    }

    // https://docs.oracle.com/javase/8/docs/api/java/io/DataInput.html#readUTF--
    protected readUTFBody(byteLength: number): string {
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
                if (i+1 > bytes.length) throw new exc.UTFDataFormatException();
                const b = bytes[i++];
                if ((b & 0b1100_0000) !== 0b1000_0000) throw new exc.UTFDataFormatException();
                resultChars[resultCharsOffset] = (((a & 0x1F) << 6) | (b & 0x3F));
            }
            // Three-byte group
            else if ((a & 0b1111_0000) === 0b1110_0000) {
                if (i+2 > bytes.length) throw new exc.UTFDataFormatException();
                const b = bytes[i++];
                const c = bytes[i++];
                if ((b & 0b1100_0000) !== 0b1000_0000) throw new exc.UTFDataFormatException();
                if ((c & 0b1100_0000) !== 0b1000_0000) throw new exc.UTFDataFormatException();
                resultChars[resultCharsOffset] = (((a & 0x0F) << 12) | ((b & 0x3F) << 6) | (c & 0x3F));
            }
            // Encoding error
            else {
                throw new exc.UTFDataFormatException();
            }
        }

        return Array.from(resultChars.subarray(0, resultCharsOffset), c => String.fromCharCode(c)).join("");
    }

    protected readTC(): number { return this.readByte(); }

    // ========== PRIMITIVE READ METHODS ==========
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

    // ========== PROTECTED OBJECT READ METHODS ==========
    protected readReset(): void {
        if (this.readTC() !== this.TC_RESET) throw new exc.InternalError();
        // TODO when depth > 0
        this.handleTable.reset();
    }
    protected readNull(): null {
        if (this.readTC() !== this.TC_NULL) throw new exc.InternalError();
        return null;
    }
    protected readHandle(): any {
        if (this.readTC() !== this.TC_REFERENCE) throw new exc.InternalError();
        const handle = this.readInt();
        return this.handleTable.getObject(handle);
    }
    protected readClass(): any {
        if (this.readTC() !== this.TC_CLASS) throw new exc.InternalError();
        const classDesc = this.readClassDesc();
        if (classDesc === null)
            throw new exc.NullPointerException();

        const result = classDesc.cl;
        const handle = this.handleTable.newHandle(result);
        return result;
    }
    protected readClassDesc(): ObjectStreamClass | null {
        const tc = this.peekByte();

        switch (tc) {
            case this.TC_NULL:
                return this.readNull();
            case this.TC_PROXYCLASSDESC:
                return this.readProxyDesc();
            case this.TC_CLASSDESC:
                return this.readNonProxyDesc();
            case this.TC_REFERENCE:
                const d = this.readHandle();
                if (!(d instanceof ObjectStreamClass))
                    throw new exc.ClassCastException(d);
                d.checkInitialized();
                return d;
            default:
                throw new exc.StreamCorruptedException("invalid classDesc type code: " + tcHex(tc));
        }
    }
    protected readProxyDesc(): ObjectStreamClass<true> {
        if (this.readTC() !== this.TC_PROXYCLASSDESC) throw new exc.InternalError();
        const desc = new ObjectStreamClass(null, null, true);
        const handle = this.handleTable.newHandle(desc);

        const proxyInterfaces: string[] = [];
        const numIfaces = this.readInt();
        for (let i=0; i<numIfaces; i++) {
            proxyInterfaces.push(this.readUTF());
        }

        const cl = this.resolveProxyClass(proxyInterfaces);
        const annotation = this.readAnnotation();
        const superDesc = this.readClassDesc();
        desc.initProxy(cl, proxyInterfaces, annotation, superDesc);

        return desc;
    }
    protected resolveProxyClass(proxyInterfaces: string[]): typeof BaseProxy {
        const ifacesStr = proxyInterfaces.join(",");

        if (!this.proxyClasses.has(ifacesStr)) {
            const classId = this.proxyClasses.size.toString();
            const className = "JavaProxy" + classId;
            const newClass = {[className]: class extends BaseProxy {
                static readonly proxyInterfaces = proxyInterfaces;
            }}[className];

            this.proxyClasses.set(ifacesStr, newClass);
        }

        return this.proxyClasses.get(ifacesStr)!;
    }
    protected readNonProxyDesc(): ObjectStreamClass<false> {
        if (this.readTC() !== this.TC_CLASSDESC) throw new exc.InternalError();

        const name = this.readUTF();
        const suid = this.readLong();
        const desc = new ObjectStreamClass(name, suid, false);
        const handle = this.handleTable.newHandle(desc);

        const flags = this.readUnsignedByte();
        const fields = this.readFieldDescs(name);

        const annotation = this.readAnnotation();
        const superDesc = this.readClassDesc();
        const cl = this.resolveClass(name, this.getClassType(flags), desc, superDesc);
        desc.initNonProxy(cl, flags, fields, annotation, superDesc);

        return desc;
    }
    protected readFieldDescs(className: string): FieldDesc[] {
        const numFields = this.readShort();
        const fields: FieldDesc[] = [];
        for (let i=0; i<numFields; i++) {
            fields.push(this.readFieldDesc(className));
        }
        return fields;
    }
    protected readFieldDesc(className: string): FieldDesc {
        const typecode = String.fromCodePoint(this.readUnsignedByte());
        const fieldName = this.readUTF();

        switch (typecode) {
            case 'L': case '[':
                const fieldClassName = this.readString();
                return {typecode, name: fieldName, className: fieldClassName};

            case 'B': case 'C': case 'D': case 'F': case 'I': case 'J': case 'S': case 'Z':
                return {typecode, name: fieldName};

            default:
                throw new exc.InvalidClassException(className, "invalid typecode for field " + fieldName + ": " + typecode);
        }
    }
    protected getClassType(flags: number): ClassType {
        if      (flags & this.SC_ENUM)           return "enum";
        else if (flags & this.SC_SERIALIZABLE)   return "serializable";
        else if (flags & this.SC_EXTERNALIZABLE) return "externalizable";
        else                                      return "general";
    }
    protected resolveClass(
        name: string,
        type: ClassType,
        desc: ObjectStreamClass,
        superDesc: ObjectStreamClass | null,
    ): any {
        if (this.registeredClasses.has(name))
            return this.registeredClasses.get(name)![1];

        const fallbackSuperClass = {
            "general":        BaseFallbackClass,
            "serializable":   BaseFallbackSerializable,
            "externalizable": BaseFallbackExternalizable,
            "enum":           BaseFallbackEnum,
        }[type];
        const superClass = superDesc !== null ? (superDesc.cl as new () => any) : fallbackSuperClass;

        const cl: (new () => BaseFallbackClass) = {
            [name]: class extends superClass {
                static $desc = desc
            }
        }[name];
        // @ts-expect-error
        cl.displayName = name

        if (type === "enum")
            return new Proxy(cl, EnumProxyHandler);

        return cl;
    }
    protected readString(): string {
        const tc = this.peek1();
        let str: string;
        switch (tc) {
            case this.TC_STRING:
                this.readTC();
                str = this.readUTF();
                break;

            case this.TC_LONGSTRING:
                this.readTC();
                str = this.readLongUTF();
                break;

            case this.TC_REFERENCE:
                str = this.readHandle();
                if (typeof str !== "string")
                    throw new exc.ClassCastException("string reference is not a string: " + str);
                return str;

            default:
                throw new exc.StreamCorruptedException("invalid string type code: " + tcHex(tc));
        }
        this.handleTable.newHandle(str);
        return str;
    }
    protected readArray(): any[] {
        if (this.readTC() !== this.TC_ARRAY) throw new exc.InternalError();

        const desc = this.readClassDesc();
        const len = this.readInt();
        if (len < 0)
            throw new exc.StreamCorruptedException("Array length is negative");

        const result: any[] = [];
        const handle = this.handleTable.newHandle(result);

        if (!desc?.name?.startsWith("[") || desc.name.length < 2)
            throw new exc.StreamCorruptedException("Invalid array desc name: " + desc?.name);
        const typecode = desc.name.charAt(1);

        for (let i=0; i<len; i++) {
            result.push(this.readValue(typecode));
        }

        return result;
    }
    protected readValue(typecode: string): any {
        switch (typecode) {
            case '[':
            case 'L':
                // TODO: type checking
                return this.readObject();
            case 'B': return this.readByte();
            case 'C': return this.readChar();
            case 'D': return this.readDouble();
            case 'F': return this.readFloat();
            case 'I': return this.readInt();
            case 'J': return this.readLong();
            case 'S': return this.readShort();
            case 'Z': return this.readBoolean();
            default:
                throw new exc.StreamCorruptedException("Unkown field value typecode: " + typecode);
        }
    }
    protected readEnum(): Enum {
        if (this.readTC() !== this.TC_ENUM) throw new exc.InternalError();

        const desc = this.readClassDesc();
        if (!desc?.isEnum)
            throw new exc.InvalidClassException(desc?.name ?? null, "non-enum class");

        const handle = this.handleTable.newHandle(null);
        const constantName = this.readString();

        if (!(constantName in desc.cl))
            throw new exc.InvalidClassException(desc.name, "enum constant name doesn't exist: " + constantName);
        // @ts-expect-error
        const result = desc.cl[constantName];

        this.handleTable.replaceObject(handle, null, result);

        return result;
    }
    protected readOrdinaryObject(): any {
        if (this.readTC() !== this.TC_OBJECT) throw new exc.InternalError();

        const desc = this.readClassDesc();
        if (desc === null)
            throw new exc.NullPointerException();

        const result = new desc.cl();
        const handle = this.handleTable.newHandle(result);

        if (desc.externalizable) {
            this.readExternalData(result, desc);
        } else if (desc.serializable) {
            this.readSerialData(result, desc);
        } else {
            throw new exc.InvalidClassException(desc.name, "not serializable and not externalizable");
        }

        if (typeof result.readResolve === "function") {
            const replaced = result.readResolve();
            this.handleTable.replaceObject(handle, result, replaced);
            return replaced;
        } else {
            return result;
        }
    }
    protected readExternalData(obj: Externalizable, desc: ObjectStreamClass): void {
        const registered = this.registeredClasses.get(desc.name as any)?.[1];
        if (!desc.hasBlockExternalData && desc.cl !== registered)
            throw new exc.ClassNotFoundException("Cannot deserialize instance of Externalizable class " + desc.name + " written using PROTOCOL_VERSION_1, without a matching JS-side class");

        const objSuid = Object.getPrototypeOf(obj).constructor.serialVersionUID;
        if (objSuid !== undefined && objSuid !== desc.suid)
            throw new exc.InvalidClassException(desc.name, "stream suid " + desc.suid + " doesn't match available suid " + objSuid);

        const oldContext = this.curContext;
        this.curContext = null;
        try {
            if (desc.hasBlockExternalData)
                this.setBlockDataMode(true);
            try {
                obj.readExternal(this);
            } finally {
                if (desc.hasBlockExternalData)
                    this.readAnnotation();
            }
        } finally {
            this.curContext = oldContext;
        }
    }
    protected readSerialData(obj: Serializable, objDesc: ObjectStreamClass): void {
        const descs = this.getClassDescHierarchy(objDesc);

        for (const curDesc of descs) {
            const curClass = curDesc.cl as SerializableCtor;

            let readMethod: ReadMethodT;

            if (obj instanceof curClass) {
                if (curClass.serialVersionUID !== undefined && curClass.serialVersionUID !== curDesc.suid)
                    throw new exc.InvalidClassException(curDesc.name, "stream suid " + curDesc.suid + " doesn't match available suid " + curClass.serialVersionUID);

                if (typeof curClass.prototype.readObject === "function") {
                    readMethod = curClass.prototype.readObject;
                } else {
                    readMethod = defaultReadMethod;
                }
            } else {
                if (curClass.prototype instanceof BaseFallbackClass) {
                    readMethod = defaultReadMethod;
                } else {
                    throw new exc.ClassNotFoundException(curDesc.name + " parent of " + objDesc.name + " in java but not in javascript");
                }
            }

            if (objDesc.hasWriteObjectData) {
                this.readClassDataWr(obj, curDesc, readMethod);
            } else {
                this.readClassDataNoWr(obj, curDesc, readMethod);
            }
        }
    }
    protected readClassDataNoWr(obj: Serializable, desc: ObjectStreamClass, readMethod: ReadMethodT): void {
        this.readClassData(obj, desc, readMethod);
    }
    protected readClassDataWr(obj: Serializable, desc: ObjectStreamClass, readMethod: ReadMethodT): void {
        this.readClassData(obj, desc, readMethod);
    }
    protected readClassData(obj: Serializable, desc: ObjectStreamClass, readMethod: ReadMethodT): void {
        if (readMethod === null)
            readMethod = defaultReadMethod;

        const oldContext = this.curContext;
        this.curContext = {
            desc: desc,
            obj,
            alreadyReadFields: false,
            defaultEndData: false,
        }

        this.setBlockDataMode(true);
        readMethod!.apply(obj, [this]);
        if (desc.hasWriteObjectData)
            this.readAnnotation();

        this.curContext = oldContext;
    }
    private getClassDescHierarchy(classDesc: ObjectStreamClass): ObjectStreamClass[] {
        const hierarchy = [];
        let currClass: ObjectStreamClass | null = classDesc;
        while (currClass !== null) {
            hierarchy.push(currClass);
            currClass = currClass.superDesc;
        }
        return hierarchy.reverse();
    }
    protected readFatalException(): any {
        if (this.readTC() !== this.TC_EXCEPTION) throw new exc.InternalError();

        this.handleTable.reset();

        const oldMode = this.setBlockDataMode(false);
        const tc = this.peekByte()
        this.setBlockDataMode(oldMode);

        if (tc !== this.TC_OBJECT && tc !== this.TC_REFERENCE)
            throw new exc.StreamCorruptedException("invalid exception type code: " + tcHex(tc));

        const result = this.readObject();

        // This line is required by the spec and implemented in OpenJDK's ObjectOutputStream,
        // but not in OpenJDK's ObjectInputStream. This is a bug in OpenJDK.
        this.handleTable.reset();

        return result;
    }
    protected readAnnotation(): any[] {
        const result = [];

        while (true) {
            if (this.blockDataMode) {
                const block = this.read(Infinity);
                if (block.length > 0) result.push(block);
                this.setBlockDataMode(false);
            }
            switch (this.peekByte()) {
                case this.TC_BLOCKDATA:
                case this.TC_BLOCKDATALONG:
                    this.setBlockDataMode(true);
                    break;

                case this.TC_ENDBLOCKDATA:
                    this.readTC();
                    return result;

                default:
                    result.push(this.readObject());
                    break;
            }
        }
    }

    // ========== OBJECT READ METHODS ==========
    readObject(): any {
        const oldMode = this.blockDataMode;
        if (this.blockDataMode) {
            this.peek1();
            if (this.remainingInBlock > 0) {
                throw new exc.OptionalDataException(this.remainingInBlock);
            } else if (this.curContext?.defaultEndData) {
                // Fix for 4360508
                throw new exc.OptionalDataException(true);
            }
            this.setBlockDataMode(false);
        }

        let tc;

        // Skip resets
        while ((tc = this.peekByte()) === this.TC_RESET)
            this.readReset();

        try {
            switch (tc) {
                case this.TC_NULL:
                    return this.readNull();

                case this.TC_REFERENCE:
                    return this.readHandle();

                case this.TC_CLASS:
                    return this.readClass();

                case this.TC_CLASSDESC:
                case this.TC_PROXYCLASSDESC:
                    return this.readClassDesc();

                case this.TC_STRING:
                case this.TC_LONGSTRING:
                    return this.readString();

                case this.TC_ARRAY:
                    return this.readArray();

                case this.TC_ENUM:
                    return this.readEnum();

                case this.TC_OBJECT:
                    return this.readOrdinaryObject();

                case this.TC_EXCEPTION:
                    const ex = this.readFatalException();
                    throw new exc.WriteAbortedException("writing aborted", ex);

                case this.TC_ENDBLOCKDATA:
                    if (oldMode) {
                        throw new exc.OptionalDataException(true);
                    } else {
                        throw new exc.StreamCorruptedException("unexpected end of block data");
                    }

                default:
                    throw new exc.StreamCorruptedException("invalid object type code: " + tcHex(tc));
            }
        }
        finally {
            this.setBlockDataMode(oldMode);
        }
    }

    readFields(): Map<string, any> {
        if (this.curContext === null)
            throw new exc.NotActiveException("Not inside a readObject method");

        if (this.curContext.alreadyReadFields)
            throw new exc.NotActiveException("Fields already read");

        const fields = this.curContext.desc.fields;
        if (fields === null)
            throw new exc.InternalError();

        this.setBlockDataMode(false);
        const result = new Map();
        for (const field of fields) {
            result.set(field.name, this.readValue(field.typecode));
        }
        this.setBlockDataMode(true);

        this.curContext.alreadyReadFields = true;
        if (!this.curContext.desc.hasWriteObjectData)
            this.curContext.defaultEndData = true;

        return result;
    }

    defaultReadObject(): void {
        const fields = this.readFields();

        const obj = this.curContext?.obj!;
        for (const [k, v] of fields.entries()) {
            // @ts-expect-error
            obj[k] = v;
        }
    }

    readEverything(): any[] {
        const result = [];

        try {
            while (true) {
                const block = this.read(Infinity);
                if (block.length > 0) result.push(block);
                result.push(this.readObject());
            }
        } catch (e) {
            if (!(e instanceof exc.OptionalDataException || e instanceof exc.EOFException))
                throw e;
        }

        return result;
    }

    // ========== PROTECTED CLASS REGISTRATION METHODS ==========
    protected registerClass0(name: string, clazz: any, type: ClassType): void{
        this.registeredClasses.set(name, [type, clazz]);
    }

    // ========== CLASS REGISTRATION METHODS ==========
    registerSerializable(name: string, ctor: SerializableCtor): void {
        return this.registerClass0(name, ctor, "serializable");
    }
    registerExternalizable(name: string, ctor: ExternalizableCtor): void {
        return this.registerClass0(name, ctor, "externalizable");
    }
    registerEnum(name: string, enum_: Enum): void {
        return this.registerClass0(name, enum_, "enum");
    }
    registerClass(name: string, clazz: any): void {
        return this.registerClass0(name, clazz, "general");
    }
}
export default ObjectInputStream;

export class ByteArray {
    protected static getIntegral(arr: Uint8Array, numBytes: number, signed: boolean): bigint {
        if (arr.length < numBytes) {
            throw new exc.IndexOutOfBoundsException();
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

    static getBoolean(arr: Uint8Array): boolean {
        if (arr.length < 1) throw new exc.IndexOutOfBoundsException();
        return arr[0] !== 0;
    }

    static getByte(arr: Uint8Array): number {
        return Number(this.getIntegral(arr, 1, true));
    }

    static getUnsignedByte(arr: Uint8Array): number {
        return Number(this.getIntegral(arr, 1, false))
    }

    static getChar(arr: Uint8Array): string {
        return String.fromCharCode(Number(this.getIntegral(arr, 2, false)));
    }

    static getShort(arr: Uint8Array): number {
        return Number(this.getIntegral(arr, 2, true));
    }

    static getUnsignedShort(arr: Uint8Array): number {
        return Number(this.getIntegral(arr, 2, false));
    }

    static getInt(arr: Uint8Array): number {
        return Number(this.getIntegral(arr, 4, true));
    }

    static getLong(arr: Uint8Array): bigint {
        return this.getIntegral(arr, 8, true);
    }

    static getFloat(arr: Uint8Array): number {
        if (arr.length < 4) throw new exc.IndexOutOfBoundsException();
        return new DataView(arr.subarray(0, 4).buffer).getFloat32(0, false);
    }

    static getDouble(arr: Uint8Array): number {
        if (arr.length < 8) throw new exc.IndexOutOfBoundsException();
        return new DataView(arr.subarray(0, 8).buffer).getFloat64(0, false);
    }
}

export class HandleTable {
    private table: Map<number, any> = new Map();
    private currHandle = ObjectInputStream.baseWireHandle;

    reset(): void {
        this.table.clear();
        this.currHandle = ObjectInputStream.baseWireHandle;
    }

    newHandle(obj: any): number {
        const handle = this.currHandle++;
        this.table.set(handle, obj);
        return handle;
    }

    getObject(handle: number): any {
        if (!this.table.has(handle))
            throw new exc.StreamCorruptedException("Object handle doesn't exist: " + handle);
        return this.table.get(handle)!;
    }

    replaceObject(handle: number, oldObj: any, newObj: any): void {
        if (this.table.get(handle) !== oldObj)
            throw new exc.IllegalStateException(`Replaced handle ${handle} doesn't refer to object ${oldObj}`);

        this.table.set(handle, newObj);
    }
}

function tcHex(tc: number): string {
    return tc.toString(16).padStart(2, '0');
}

export class ObjectStreamClass<IS_PROXY extends boolean = boolean> {
    cl: new () => any
    name: IS_PROXY extends false ? string : null
    suid: IS_PROXY extends false ? bigint : null
    fields: IS_PROXY extends false ? FieldDesc[] : null

    isProxy: IS_PROXY
    proxyInterfaces: IS_PROXY extends true ? string[] : null

    isEnum: boolean
    serializable: boolean
    externalizable: boolean
    hasWriteObjectData: boolean
    hasBlockExternalData: boolean

    annotation: any[]

    superDesc: ObjectStreamClass | null

    initialized: boolean

    constructor(
        name: IS_PROXY extends false ? string : null,
        suid: IS_PROXY extends false ? bigint : null,
        isProxy: IS_PROXY
    ) {
        this.initialized = false;
        this.name = name;
        this.suid = suid
        this.isProxy = isProxy;

        // Set default values
        this.cl = Object;
        this.fields = (isProxy ? null : []) as any;
        this.proxyInterfaces = (isProxy ? [] : null) as any;
        this.isEnum = false;
        this.serializable = false;
        this.externalizable = false;
        this.hasWriteObjectData = false;
        this.hasBlockExternalData = false;
        this.annotation = [];
        this.superDesc = null;
    }

    initNonProxy(this: ObjectStreamClass<false>,
        cl: any,
        flags: number,
        fields: FieldDesc[],
        annotation: any[],
        superDesc: ObjectStreamClass | null,
    ) {
        if (this.isProxy)
            throw new exc.IllegalStateException("initialize non-proxy on a proxy class");
        if (this.initialized)
            throw new exc.IllegalStateException("already initialized non-proxy");

        this.cl = cl;

        this.isEnum               = (flags & ObjectInputStream.SC_ENUM)           !== 0;
        this.serializable         = (flags & ObjectInputStream.SC_SERIALIZABLE)   !== 0;
        this.externalizable       = (flags & ObjectInputStream.SC_EXTERNALIZABLE) !== 0;
        this.hasWriteObjectData   = (flags & ObjectInputStream.SC_WRITE_METHOD)   !== 0;
        this.hasBlockExternalData = (flags & ObjectInputStream.SC_BLOCK_DATA)     !== 0;

        this.fields = fields;
        this.annotation = annotation;
        this.superDesc = superDesc;

        if (this.serializable && this.externalizable)
            throw new exc.InvalidClassException(this.name, "serializable and externalizable flags conflict");
        if (this.isEnum && this.suid !== 0n)
            throw new exc.InvalidClassException(this.name, "enum descriptor has non-zero serialVersionUID: " + this.suid);
        if (this.isEnum && this.fields.length > 0)
            throw new exc.InvalidClassException(this.name, "enum descriptor has non-zero field count: " + this.fields.length);

        this.initialized = true;
    }

    initProxy(this: ObjectStreamClass<true>,
        cl: any,
        proxyInterfaces: string[],
        annotation: any[],
        superDesc: ObjectStreamClass | null,
    ) {
        if (!this.isProxy)
            throw new exc.IllegalStateException("initialize proxy on a non-proxy class");
        if (this.initialized)
            throw new exc.IllegalStateException("already initialized proxy");

        this.cl = cl;
        this.proxyInterfaces = proxyInterfaces;
        this.annotation = annotation;
        this.superDesc = superDesc;

        this.initialized = true;
    }

    checkInitialized(): void {
        if (!this.initialized)
            throw new exc.InvalidClassException(this.name, "Class descriptor should be initialized");
    }
}

export type FieldDesc = {
    typecode: 'B' | 'C' | 'D' | 'F' | 'I' | 'J' | 'S' | 'Z',
    name: string,
} | {
    typecode: '[' | 'L',
    name: string,
    className: string,
}

export interface InvocationHandler {
    invoke: (proxy: BaseProxy, method: string, args: any[]) => any
}

export abstract class BaseProxy {
    static readonly proxyInterfaces: string[] = []

    h?: InvocationHandler

    constructor(h?: InvocationHandler) {
        this.h = h;

        return new Proxy(this, {get: (target, prop, receiver) => {
            if (typeof prop !== "string")
                return Reflect.get(target, prop, receiver);

            if (this.h === undefined || typeof this.h.invoke !== "function")
                throw new TypeError("invocation handler doesn't have invoke method");

            const h = this.h;
            return (...args: any[]) => {
                return h.invoke(target, prop, args);
            }
        }})
    }

    static getInterfaces(): string[] {
        return this.proxyInterfaces;
    }
}

export interface Serializable {
    readObject?(ois: ObjectInputStream): void
    readResolve?(): any
    [key: string | symbol]: any  // To prevent ts(2559)
}
export interface SerializableCtor {
    serialVersionUID?: bigint
    new (): Serializable
}
export type ReadMethodT = NonNullable<Serializable["readObject"]>;
export interface Externalizable {
    readExternal(ois: ObjectInputStream): void
    readResolve?(): any
}
export interface ExternalizableCtor {
    serialVersionUID?: bigint
    new (): Externalizable
}
export interface Enum {
    [key: string]: any
}

export abstract class BaseFallbackClass {
    static $desc: ObjectStreamClass<false>
}
export abstract class BaseFallbackSerializable extends BaseFallbackClass implements Serializable {
    [field: string]: any
    $annotation: any[][] = []

    readObject(ois: ObjectInputStream): void {
        ois.defaultReadObject();
        this.$annotation.push(ois.readEverything());
    }
}
export abstract class BaseFallbackExternalizable extends BaseFallbackClass implements Externalizable {
    $annotation: any[] = []

    readExternal(ois: ObjectInputStream): void {
        this.$annotation = ois.readEverything();
    }
}

export abstract class BaseFallbackEnum extends BaseFallbackClass {
    // @ts-expect-error
    static [key: string]: string
}
export const EnumProxyHandler: ProxyHandler<BaseFallbackEnum> = {
    get(target, prop) {
        if (prop in target)
            return (target as any)[prop];
        if (typeof prop !== "string") return undefined;
        return prop;
    },
    has(target, prop) {
        return (prop in target) || (typeof prop === "string");
    },
}

type ClassType = "serializable" | "externalizable" | "enum" | "general"
type CallbackContext = {
    obj: Serializable | Externalizable,
    desc: ObjectStreamClass,
    alreadyReadFields: boolean,
    defaultEndData: boolean,
}

function defaultReadMethod(ois: ObjectInputStream) {
    ois.defaultReadObject();
}

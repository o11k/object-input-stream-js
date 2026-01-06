import ObjectInputStream, { Externalizable, ObjectStreamClass, Serializable, type OisOptions } from ".";
import * as exc from "./exceptions";


type CSTNode = {
    type: string,
    parent: CSTNode | null,
    span: {start: number, end: number},
    value: any,
    error?: any,
    children: CSTNode[],
}


export class ObjectInputStreamAST extends ObjectInputStream {
    protected cst: CSTNode;
    protected cstStack: CSTNode[];
    protected finalized = false;

    constructor(data: Uint8Array, options?: OisOptions) {
        super(data, options);

        const rootNode: CSTNode = {
            type: "root",
            span: {start: 0, end: data.length},
            value: null,
            parent: null,
            children: [],
        };

        rootNode.children = [{
            type: "magic",
            span: {start: 0, end: 2},
            value: this.STREAM_MAGIC,
            parent: rootNode,
            children: [],
        }, {
            type: "version",
            span: {start: 2, end: 4},
            value: this.STREAM_VERSION,
            parent: rootNode,
            children: [],
        }, {
            type: "contents",
            span: {start: 4, end: data.length},
            value: null,
            parent: rootNode,
            children: [],
        }]

        this.cst = rootNode;
        this.cstStack = [this.cst, this.cst.children[2]];
    }

    getCST() {
        return this.cst;
    }

    @traceMethod("primitive/boolean", {keep: true})
    readBoolean(): boolean { return super.readBoolean(); }
    @traceMethod("primitive/byte", {keep: true})
    readByte(): number { return super.readByte(); }
    @traceMethod("primitive/unsigned-byte", {keep: true})
    readUnsignedByte(): number { return super.readUnsignedByte(); }
    @traceMethod("primitive/char", {keep: true})
    readChar(): string { return super.readChar(); }
    @traceMethod("primitive/short", {keep: true})
    readShort(): number { return super.readShort(); }
    @traceMethod("primitive/unsigned-short", {keep: true})
    readUnsignedShort(): number { return super.readUnsignedShort(); }
    @traceMethod("primitive/int", {keep: true})
    readInt(): number { return super.readInt(); }
    @traceMethod("primitive/long", {keep: true})
    readLong(): bigint { return super.readLong(); }
    @traceMethod("primitive/float", {keep: true})
    readFloat(): number { return super.readFloat(); }
    @traceMethod("primitive/double", {keep: true})
    readDouble(): number { return super.readDouble(); }

    @traceMethod("tc", {keep: true})
    protected readTC(): number { return super.readTC(); }

    @traceMethod("read1")
    read1() { return super.read1(); }
    @traceMethod("read")
    read(len: number) { return super.read(len); }
    @traceMethod("block-header", {keep: true})
    protected readBlockHeader(): number { return super.readBlockHeader(); }

    @traceMethod("utf", {keep: true})
    readUTF() { return super.readUTF(); }
    @traceMethod("long-utf", {keep: true})
    protected readLongUTF() { return super.readLongUTF(); }
    @traceMethod("utf-body")
    protected readUTFBody(byteLength: number) { return super.readUTFBody(byteLength); }

    @traceMethod("object/reset")
    protected readReset() { return super.readReset(); }
    @traceMethod("object/null")
    protected readNull() { return super.readNull(); }
    @traceMethod("object/handle")
    protected readHandle() { return super.readHandle(); }
    @traceMethod("object/class")
    protected readClass() { return super.readClass(); }
    @traceMethod("object/class-desc")
    protected readClassDesc() { return super.readClassDesc(); }
    @traceMethod("proxy-desc")
    protected readProxyDesc() { return super.readProxyDesc(); }
    @traceMethod("non-proxy-desc")
    protected readNonProxyDesc() { return super.readNonProxyDesc(); }
    @traceMethod("object/string", {keep: true})
    protected readString() { return super.readString(); }
    @traceMethod("object/array")
    protected readArray() { return super.readArray(); }
    @traceMethod("object/enum")
    protected readEnum() { return super.readEnum(); }
    @traceMethod("object/instance")
    protected readOrdinaryObject() { return super.readOrdinaryObject(); }
    @traceMethod("external-data")
    protected readExternalData(obj: Externalizable, desc: ObjectStreamClass) { return super.readExternalData(obj, desc); }
    @traceMethod("serial-data")
    protected readSerialData(obj: Serializable, desc: ObjectStreamClass) { return super.readSerialData(obj, desc); }
    @traceMethod("object/exception")
    protected readFatalException() { return super.readFatalException(); }
    @traceMethod("annotation")
    protected readAnnotation() { return super.readAnnotation(); }

    // @traceMethod("object")
    // readObject() { return super.readObject(); }
    @traceMethod("fields")
    readFields() { return super.readFields(); }
}


function traceMethod<T, ARGS extends any[]>(type: string, options?: {
    keep?: boolean,
}) {return (method: (this: ObjectInputStreamAST, ...args: ARGS) => T) => {
    return function decorated(this: ObjectInputStreamAST, ...args: ARGS): T {
        if (!(this instanceof ObjectInputStreamAST))
            throw new exc.InternalError();

        if (this.finalized)
            throw new exc.NotActiveException();

        const parent = (this.cstStack?.length > 0) ? this.cstStack[this.cstStack.length-1] : undefined;

        const node: CSTNode = {
            type: type,
            span: {start: this.offset, end: this.offset},
            value: null,
            // @ts-expect-error
            parent: parent,
            children: [],
        }


        if (parent !== undefined) {
            parent.children.push(node);
            this.cstStack.push(node);
        }

        let result: T;
        try {
            result = method.apply(this, args);
            if (options?.keep)
                node.value = result;
            return result;
        } catch (e) {
            node.error = e;
            throw e;
        } finally {
            if (parent !== undefined) {
                const popped = this.cstStack.pop();
                assertInternal(popped === node);
            }
        }
    }
}}

function assertInternal(predicate: boolean): asserts predicate {
    if (!predicate)
        throw new exc.InternalError();
}

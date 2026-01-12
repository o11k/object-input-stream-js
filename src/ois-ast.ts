/**
 * Forgive me father, for I have sinned.
 */

import ObjectInputStream, { ast, Externalizable, FieldDesc, ObjectStreamClass, Serializable, type OisOptions, internal } from ".";
import * as exc from "./exceptions";

type CSTNode = {
    type: string,
    parent: CSTNode | null,
    span: {start: number, end: number},
    value: unknown,
    error?: any,
    children: CSTNode[],
}


export class ObjectInputStreamAST extends ObjectInputStream {
    protected cst: CSTNode;
    protected cstStack: CSTNode[];
    protected finalized = false;
    protected ast: ast.Ast | null = null;
    // How many resets happened so far
    protected epoch: number = 0;

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

    getAST() {
        if (this.offset < this.data.length) {
            throw new Error("Not done reading");
        }
        if (this.finalized) {
            assert(this.ast !== null);
            return this.ast;
        }
        this.finalized = true;
        return cstToAst(this.cst, this.data);
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

    @traceMethod("read1", {keep: true})
    read1() { return super.read1(); }
    @traceMethod("read")
    read(len: number) { return super.read(len); }
    @traceMethod("block-header", {keep: true})
    protected readBlockHeader(): number { return super.readBlockHeader(); }

    @traceMethod("utf", {keep: true})
    readUTF() { return super.readUTF(); }
    @traceMethod("long-utf", {keep: true})
    protected readLongUTF() { return super.readLongUTF(); }
    @traceMethod("utf-body", {keep: true})
    protected readUTFBody(byteLength: number) { return super.readUTFBody(byteLength); }

    @traceMethod("do-reset")
    protected reset(): void {
        assert(this.cstStack.length > 0);
        const currNode = this.cstStack[this.cstStack.length-1];
        assert(currNode.type === "do-reset");
        currNode.value = ++this.epoch;
        return super.reset();
    }

    @traceMethod("new-handle")
    protected newHandle(obj: any): number {
        assert(this.cstStack.length > 0);
        const currNode = this.cstStack[this.cstStack.length-1];
        assert(currNode.type === "new-handle");
        const handle = super.newHandle(obj);
        currNode.value = {epoch: this.epoch, handle: handle};
        return handle;
    }

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
    @traceMethod("class-data-wr")
    protected readClassDataWr(obj: Serializable, desc: ObjectStreamClass, readMethod: internal.ReadMethodT): void {
        return super.readClassDataWr(obj, desc, readMethod);
    }
    @traceMethod("class-data-no-wr")
    protected readClassDataNoWr(obj: Serializable, desc: ObjectStreamClass, readMethod: internal.ReadMethodT): void { return super.readClassDataNoWr(obj, desc, readMethod); }
    @traceMethod("object/exception")
    protected readFatalException() { return super.readFatalException(); }
    @traceMethod("annotation")
    protected readAnnotation() { return super.readAnnotation(); }

    @traceMethod("values")
    readFields() { return super.readFields(); }
    @traceMethod("fields")
    protected readFieldDescs(className: string): FieldDesc[] { return super.readFieldDescs(className); }
    @traceMethod("field")
    protected readFieldDesc(className: string): FieldDesc { return super.readFieldDesc(className); }
}


function traceMethod<T, ARGS extends any[]>(type: string, options?: {
    keep?: boolean,
}) {return (method: (this: ObjectInputStreamAST, ...args: ARGS) => T) => {
    return function decorated(this: ObjectInputStreamAST, ...args: ARGS): T {
        if (!(this instanceof ObjectInputStreamAST))
            throw new exc.InternalError();

        if (this.finalized)
            throw new exc.NotActiveException();

        const parent = (this.cstStack?.length > 0) ? this.cstStack[this.cstStack.length-1] : null;

        const node: CSTNode = {
            type: type,
            span: {start: this.offset, end: this.offset},
            value: null,
            parent: parent,
            children: [],
        }

        if (parent !== null) {
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
            node.span.end = this.offset;
            if (parent !== null) {
                const popped = this.cstStack.pop();
                assert(popped === node);
            }
        }
    }
}}

function assert(predicate: boolean, message="assertion error"): asserts predicate {
    if (!predicate)
        throw new exc.InternalError(message);
}

/**
 * Convert a concrete-syntax-tree to an abstract-syntax-tree.
 * This function is destructive to the CST.
 */
function cstToAst(cst: CSTNode, data: Uint8Array): ast.Ast {
    hoistBlockHeaders(cst);
    hoistResets(cst);

    // Remove calls to "read" from primitives and strings
    removeNodesWhere(cst, node => node.type === "read" && node.parent !== null && (
        node.parent.type.startsWith("primitive/") || node.parent.type === "utf-body"
    ))
    // Remove calls to "readByte" from tc
    removeNodesWhere(cst, node => node.type === "primitive/byte" && node.parent?.type === "tc");
    // Remove empty nodes that shouldn't be empty
    removeNodesWhere(cst, node => {
        if (node.span.start < node.span.end) return false;
        return (
            node.type !== "contents" &&
            node.type !== "serial-data" &&
            node.type !== "external-data" &&
            node.type !== "class-data-no-wr"
        )
}, {recursive: true});

    handleBlocks(cst);

    const root = trasformCSTBottomUp(cst, cstToAstNode);
    assert(root.type === "root");
    return {root, data};
}

/**
 * Instead of headers being children of primitives, make them their siblings.
 * They will later become their parents.
 */
function hoistBlockHeaders(cst: CSTNode): void {
    const headers = [...traverseCST(cst)].filter(node => node.type === "block-header");
    for (const header of headers) {
        while (header.parent !== null && !canContainContent(header.parent)) {
            assert(header.parent.children[0] === header);
            hoistFirstChild(header);
        }
        assert(header.parent !== null);
    }
}

function pp(node: ast.Node, indent=0) {
    let res = " ".repeat(indent) + node.type;
    if (node.type === "object") res += "/" + node.objectType;
    if (node.type === "primitive") res += "/" + node.dataType;
    if ((node as any).value !== null) res += ": " + (node as any).value;
    if (node.children !== null && node.children.length > 0)
        res += "\n" + node.children.map(c => pp(c,indent+1)).join("\n")
    return res;
}

/**
 * Instead of resets being children of objects / block headers, make them their siblings/
 */
function hoistResets(cst: CSTNode): void {
    const resets = [...traverseCST(cst)].filter(node => node.type === "object/reset");
    for (const reset of resets) {
        while (reset.parent !== null && !canContainContent(reset.parent)) {
            assert(reset.parent.children[0] === reset);
            hoistFirstChild(reset);
        }
        assert(reset.parent !== null);
    }
}

function canContainContent(node: CSTNode) {
    if (node === null) return false;
    const type = node.type;
    return type === "class-data-no-wr" || type === "class-data-wr" || type === "contents" || type === "external-data";
}

/**
 * Manipulate the CST s.t `child` becomes its parent's sibling.
 * `child` must be its parent's first child.
 */
function hoistFirstChild(child: CSTNode) {
    const parent = child.parent;
    assert(parent !== null);
    assert(parent.children.indexOf(child) === 0);
    const grandParent = parent.parent;
    assert(grandParent !== null);
    const parentIndex = grandParent.children.indexOf(parent);
    assert(parentIndex !== -1);

    parent.children.shift();
    parent.span.start = child.span.end;

    grandParent.children.splice(parentIndex, 0, child);
    child.parent = grandParent;
}

function handleBlocks(cst: CSTNode) {
    // resets that are in between block headers
    const blockResets = removeNodesWhere(cst, node => {
        if (node.type !== "object/reset") return false;
        assert(node.parent !== null);
        const siblings = node.parent.children;
        const index = siblings.indexOf(node);
        assert(0 <= index);
        
        const nextRight = siblings.slice(index+1).find(node => node.type !== "object/reset");
        const nextLeft  = siblings.slice(0,index).reverse().find(node => node.type !== "object/reset");

        return (
               nextRight !== undefined && nextRight.type === "block-header"
            && nextLeft  !== undefined && nextLeft.type  === "block-header"
        )
    }, {recursive: true})

    const blocks =
        removeNodesWhere(cst, node => node.type === "block-header", {recursive: true})
        .filter(header => header.span.start < header.span.end)
        .map(header => {
            assert(header.value !== -1);
            let parent = header.parent;
            assert(parent !== null);
            assert(typeof header.value === "number");
            const span = {start: header.span.start, end: header.span.end + header.value};
            return {header, parent, span};
        });

    if (blocks.length === 0)
        return;

    // Group blocks into contiguous sequences
    let currSequence: (typeof blocks[0] | typeof blockResets[0])[] = [blocks[0]];
    const blockSequences: (typeof currSequence)[] = [currSequence];
    for (let i=1; i<blocks.length; i++) {
        let prev = currSequence[currSequence.length-1];
        
        while (blockResets.length > 0 && blockResets[0].span.start === prev.span.end) {
            const reset = blockResets.shift();
            assert(reset !== undefined);
            currSequence.push(reset);
            prev = reset;
        }

        const curr = blocks[i];
        if (prev.span.end === curr.span.start) {
            currSequence.push(curr);
        } else {
            currSequence = [curr];
            blockSequences.push(currSequence);
        }
    }

    assert(blockResets.length === 0);

    for (const sequence of blockSequences) {
        assert(sequence.length > 0);
        assert(sequence.every(block => block.parent === sequence[0].parent));

        const parent = sequence[0].parent;
        assert(parent !== null);
        const start = sequence[0].span.start;
        const end = sequence[sequence.length-1].span.end;

        // Get the values stored in each sequence
        const values = removeNodesWhere(cst, node => (
            node.parent === parent && start <= node.span.start && node.span.end <= end
        ), {recursive: true});

        assert(values.every(v => v.type.startsWith("primitive/") || v.type === "utf" || v.type === "read"));
        values.forEach(v => removeNodesWhere(v, node => node.type === "block-header", {recursive: true}))

        const sequenceNode: CSTNode = {
            type: "blockdata-sequence",
            span: {start, end},
            parent: null,
            value: values,
            children: [],
        }

        sequenceNode.children = sequence.map((seqItem) => {
            if ("type" in seqItem && seqItem.type === "object/reset") {
                return seqItem;
            }

            const {parent, header, span} = seqItem as typeof blocks[0];
            const result = {
                type: "blockdata",
                span: span,
                parent: sequenceNode,
                value: null,
                children: [...header.children],
            };
            result.children.push({
                type: "read",
                span: {start: header.span.end, end: span.end},
                value: null,
                parent: result,
                children: [],
            });

            return result;
        });

        insertNode(parent, sequenceNode);            
    }
}

function removeNodesWhere(cst: CSTNode, condition: (node: CSTNode) => boolean, options?: {recursive?: boolean}): CSTNode[] {
    const toRemove: CSTNode[] = [];

    for (const node of traverseCST(cst)) {
        if (condition(node)) {
            toRemove.push(node);
        }
    }

    for (const node of toRemove)
        removeNode(node, options);

    return toRemove;
}

function removeNode(node: CSTNode, options?: {recursive?: boolean}): void {
    assert(node.parent !== null);
    const nodeIndex = node.parent.children.indexOf(node);
    assert(nodeIndex !== -1);
    if (options?.recursive) {
        node.parent.children.splice(nodeIndex, 1);
    } else {
        for (const child of node.children) {
            child.parent = node.parent;
        }
        node.parent.children.splice(nodeIndex, 1, ...node.children);
    }
}

function insertNode(parent: CSTNode, child: CSTNode): void {
    assert(parent.span.start <= child.span.start && child.span.end <= parent.span.end);

    child.parent = parent

    if (parent.children.length === 0) {
        parent.children.push(child);
        return;
    }

    let inserted = false;
    for (let i=0; i<=parent.children.length; i++) {
        const left  = parent.children[i-1] as CSTNode | undefined;
        const right = parent.children[i]   as CSTNode | undefined;

        // Not overlapping
        if (left !== undefined)
            assert(child.span.end <= left.span.start || left.span.end <= child.span.start);
        if (right !== undefined)
            assert(child.span.end <= right.span.start || right.span.end <= child.span.start);

        const leftGood  = (left  === undefined) || (left.span.end  <= child.span.start);
        const rightGood = (right === undefined) || (child.span.end <= right.span.start);
        if (leftGood && rightGood) {
            parent.children.splice(i, 0, child);
            inserted = true;
            break;
        }
    }
    assert(inserted);
}

function *traverseCST(cst: CSTNode): Generator<CSTNode, undefined, undefined> {
    yield cst;
    for (const child of cst.children)
        yield* traverseCST(child);
}


function trasformCSTBottomUp<T>(cst: CSTNode, transform: (node: CSTNode, transformedChildren: T[]) => T): T {
    const children = cst.children.map(c => trasformCSTBottomUp(c, transform));
    return transform(cst, children);
}

function cstToAstNode(node: CSTNode, children: ast.Node[]): ast.Node {
    const fakeHandle = {epoch: -1, handle: -1};

    if (node.type.startsWith("primitive/")) {
        assert(children.length === 0);
        const dataType = node.type.split("/", 2)[1];
        const value = node.value;
        const span = node.span;
        switch (dataType) {
            case "boolean":
                assert(typeof value === "boolean");
                return {type: "primitive", dataType, value, span, children: null};
            case "char":
                assert(typeof value === "string");
                return {type: "primitive", dataType, value, span, children: null};
            case "long":
                assert(typeof value === "bigint");
                return {type: "primitive", dataType, value, span, children: null};
            case "byte":
            case "unsigned-byte":
            case "short":
            case "unsigned-short":
            case "int":
            case "float":
            case "double":
                assert(typeof value === "number");
                return {type: "primitive", dataType, value, span, children: null};
            default:
                throw new exc.InternalError(dataType);
        }
    }

    switch (node.type) {
        case "root": {
            assert(children.length === 3);
            const magic = children[0];
            const version = children[1];
            const contents = children[2];
            assert(magic.type === "magic");
            assert(version.type === "version");
            assert(contents.type === "contents");
            return {type: "root", span: node.span, children: [magic, version, contents]};
        }
        case "magic": {
            assert(children.length === 0);
            return {type: "magic", span: node.span, value: ObjectInputStream.STREAM_MAGIC, children: null}
        }
        case "version": {
            assert(children.length === 0);
            return {type: "version", span: node.span, value: ObjectInputStream.STREAM_VERSION, children: null}
        }
        case "contents": {
            assert(children.every(c => c.type === "blockdata-sequence" || c.type === "object"));
            return {type: "contents", span: node.span, children: children}
        }
        case "blockdata-sequence": {
            assert(children.every(c => c.type === "blockdata" || (c.type === "object" && c.objectType === "reset")));
            const rawValues = node.value as CSTNode[];
            const values: ast.Node[] = rawValues.map(v => trasformCSTBottomUp(v, cstToAstNode));
            assert(values.every(v => v.type === "primitive" || v.type === "utf"));
            return {type: "blockdata-sequence", span: node.span, values, children}
        }
        case "blockdata": {
            assert(children.length === 3);
            const tc = children[0];
            const length = children[1];
            const bytes = children[2];
            assert(tc.type === "tc")
            assert(length.type === "primitive");
            assert(bytes.type === "primitive" && bytes.dataType === "bytes");
            if (tc.value === ObjectInputStream.TC_BLOCKDATA && length.dataType === "unsigned-byte") {
                return {type: "blockdata", span: node.span, children: [tc, length, bytes]}
            } else if (tc.value === ObjectInputStream.TC_BLOCKDATALONG && length.dataType === "long") {
                return {type: "blockdata", span: node.span, children: [tc, length, bytes]}
            } else {
                throw new exc.InternalError();
            }
        }
        case "tc": {
            assert(children.length === 0);
            assert(typeof node.value === "number" && ObjectInputStream.TC_BASE <= node.value && node.value <= ObjectInputStream.TC_MAX);
            return {type: "tc", span: node.span, value: node.value as ast.TCNode["value"], children: null}
        }
        case "read1": {
            assert(children.length === 0);
            assert(typeof node.value === "number");
            return {type: "primitive", span: node.span, dataType: "unsigned-byte", value: node.value, children: null}
        }
        case "read": {
            assert(children.length === 0);
            return {type: "primitive", dataType: "bytes", span: node.span, value: null, children: null}
        }
        case "utf": {
            assert(children.length === 2);
            const length = children[0];
            const body = children[1];
            assert(length.type === "primitive" && length.dataType === "unsigned-short");
            assert(body.type === "utf-body");
            return {type: "utf", value: body.value, span: node.span, children: [length, body]}
        }
        case "long-utf": {
            assert(children.length === 2);
            const length = children[0];
            const body = children[1];
            assert(length.type === "primitive" && length.dataType === "long");
            assert(body.type === "utf-body");
            return {type: "long-utf", value: body.value, span: node.span, children: [length, body]}
        }
        case "utf-body": {
            assert(children.length === 0);
            assert(typeof node.value === "string");
            return {type: "utf-body", value: node.value, span: node.span, children: null}
        }
        case "object/reset": {
            assert(children.length === 1);
            const tc = children[0];
            assert(tc.type === "tc" && tc.value === ObjectInputStream.TC_RESET);
            return {type: "object", objectType: "reset", newEpoch: -1, span: node.span, children: [tc]}
        }
        case "object/null": {
            assert(children.length === 1);
            const tc = children[0];
            assert(tc.type === "tc" && tc.value === ObjectInputStream.TC_NULL);
            return {type: "object", objectType: "null", span: node.span, children: [tc]}
        }
        case "object/handle": {
            assert(children.length === 2);
            const tc = children[0];
            const ref = children[1];
            assert(tc.type === "tc" && tc.value === ObjectInputStream.TC_REFERENCE);
            assert(ref.type === "primitive" && ref.dataType === "int");
            return {type: "object", objectType: "prev-object", span: node.span, value: fakeHandle, children: [tc, ref]}
        }
        case "object/class": {
            assert(children.length === 1);
            const tc = children[0];
            const desc = children[0];
            assert(tc.type === "tc" && tc.value === ObjectInputStream.TC_CLASS);
            assertDescNode(desc);
            return {type: "object", objectType: "new-class", span: node.span, handle: fakeHandle, children: [tc, desc]}
        }
        case "object/class-desc": {
            assert(children.length === 1);
            const first = children[0];
            assertDescNode(first);
            return first;
        }
        case "proxy-desc": {
            assert(children.length >= 2);
            const tc = children[0];
            const numIfaces = children[1];
            assert(tc.type === "tc" && tc.value === ObjectInputStream.TC_PROXYCLASSDESC);
            assert(numIfaces.type === "primitive" && numIfaces.dataType === "int");
            assert(children.length >= 2 + numIfaces.value);
            const ifaces = children.slice(2, 2 + numIfaces.value);
            assert(ifaces.every(x => x.type === "utf"));
            assert(children.length === 2 + numIfaces.value + 2);
            const annotation = children[2 + numIfaces.value];
            const superDesc = children[2 + numIfaces.value + 1];
            assert(annotation.type === "annotation");
            assertDescNode(superDesc);
            return {type: "object", objectType: "new-class-desc", handle: fakeHandle, span: node.span, children: [tc, {
                type: "proxy-class-desc-info",
                span: {start: node.span.start+1, end: node.span.end},
                children: [numIfaces, ...ifaces, annotation, superDesc],
            }]}
        }
        case "non-proxy-desc": {
            assert(children.length === 7);
            const tc = children[0];
            const name = children[1];
            const suid = children[2];
            const flags = children[3];
            const fields = children[4];
            const annotation = children[5];
            const superDesc = children[6];
            assert(tc.type === "tc" && tc.value === ObjectInputStream.TC_CLASSDESC);
            assert(name.type === "utf");
            assert(suid.type === "primitive" && suid.dataType === "long");
            assert(flags.type === "primitive" && flags.dataType === "unsigned-byte");
            assert(fields.type === "fields");
            assert(annotation.type === "annotation");
            assertDescNode(superDesc);
            return {type: "object", objectType: "new-class-desc", handle: fakeHandle, span: node.span, children: [
                tc, name, suid, {
                    type: "class-desc-info",
                    span: {start: suid.span.end, end: node.span.end},
                    children: [flags, fields, annotation, superDesc],
                }
            ]}
        }
        case "object/string": {
            assert(children.length > 0);
            const first = children[0];
            if (first.type === "object" && first.objectType === "prev-object")
                return first;

            assert(children.length === 2);
            const tc = children[0];
            const utf = children[1];
            assert(tc.type === "tc");
            if (tc.value === ObjectInputStream.TC_STRING) {
                assert(utf.type === "utf");
                return {type: "object", objectType: "new-string", value: utf.value, handle: fakeHandle, span: node.span, children: [tc, utf]};
            } else if (tc.value === ObjectInputStream.TC_LONGSTRING) {
                assert(utf.type === "long-utf");
                return {type: "object", objectType: "new-string", value: utf.value, handle: fakeHandle, span: node.span, children: [tc, utf]};
            } else {
                throw new exc.InternalError();
            }
        }
        case "object/array": {
            assert(children.length >= 3);
            const tc = children[0];
            const desc = children[1];
            const len = children[2];
            const values = children.slice(3);
            assert(tc.type === "tc" && tc.value === ObjectInputStream.TC_ARRAY);
            assertDescNode(desc);
            assert(len.type === "primitive" && len.dataType === "int");
            assert(len.value === values.length);
            assert(values.every(v => v.type === "primitive" || v.type === "object"));
            const firstItem = values.length > 0 ? values[0] : null;
            if (firstItem?.type === "primitive") {
                assert(values.every(v => v.type === "primitive" && v.dataType === firstItem.dataType));
            } else {
                assert(values.every(v => v.type === "object"));
            }
            return {type: "object", objectType: "new-array", handle: fakeHandle, span: node.span, children: [tc, desc, len, {
                type: "values", span: {start: len.span.end, end: node.span.end}, children: values
            }]}
        }
        case "object/enum": {
            assert(children.length === 2);
            const tc = children[0];
            const desc = children[1];
            const name = children[2];
            assert(tc.type === "tc" && tc.value === ObjectInputStream.TC_ENUM);
            assertDescNode(desc);
            assertStringNode(name);
            return {type: "object", objectType: "new-enum", span: node.span, handle: fakeHandle, children: [tc, desc, name]}
        }
        case "object/instance": {
            assert(children.length === 3);
            const tc = children[0];
            const desc = children[1];
            const data = children[2];
            assert(tc.type === "tc" && tc.value === ObjectInputStream.TC_OBJECT);
            assertDescNode(desc);
            assert(data.type === "external-data" || data.type === "serial-data");
            return {type: "object", objectType: "new-object", handle: fakeHandle, span: node.span, children: [tc, desc, data]}
        }
        case "external-data": {
            // PROTOCOL_VERSION_1
            if (children.every(c => c.type === "primitive" || c.type === "object" || c.type === "utf")) {
                return {type: "external-data", protocolVersion: 1, span: node.span, children: children}
            }
            // PROTOCOL_VERSION_2
            else {
                assert(children.length > 0);
                const annotation = children[children.length-1];
                assert(annotation.type === "annotation");
                const before = children.slice(0, children.length-1);
                assert(before.every(c => c.type === "object" || c.type === "blockdata-sequence"));
                const contents = annotation.children[0];
                const endBlock = annotation.children[1];
                const newContents: ast.ContentsNode = {
                    type: "contents",
                    span: {start: node.span.start, end: contents.span.end},
                    children: [...before, ...contents.children],
                }
                return {type: "external-data", protocolVersion: 2, span: node.span, children: [{
                    type: "annotation",
                    span: node.span,
                    children: [newContents, endBlock],
                }]}
            }
        }
        case "serial-data":  {
            assert(children.every(c => c.type === "class-data"));
            return {type: "serial-data", span: node.span, children: children}
        }
        case "class-data-wr": {
            assert(children.length > 0);
            const annotation = children[children.length-1];
            assert(annotation.type === "annotation");
            let beforeValues: (ast.BlockDataSequenceNode | ast.ObjectNode)[];
            let values: ast.ValuesNode | null;
            let afterValues: (ast.BlockDataSequenceNode | ast.ObjectNode)[];
            const valuesIdx = children.findIndex(c => c.type === "values");
            if (valuesIdx === -1) {
                beforeValues = [];
                values = null;
                const tempAfter = children.slice(0, -1);
                assert(tempAfter.every(c => c.type === "blockdata-sequence" || c.type === "object"));
                afterValues = tempAfter;
            } else {
                const tempBefore = children.slice(0, valuesIdx);
                const tempValues = children[valuesIdx];
                const tempAfter = children.slice(valuesIdx+1, -1);
                assert(tempBefore.every(c => c.type === "blockdata-sequence" || c.type === "object"));
                assert(tempValues.type === "values");
                assert(tempAfter.every(c => c.type === "blockdata-sequence" || c.type === "object"));
                beforeValues = tempBefore;
                values = tempValues;
                afterValues = tempAfter;
            }
            const annotationSpan = {
                start: afterValues.length > 0 ? afterValues[0].span.start : annotation.span.start,
                end: annotation.span.end,
            };
            const annotationContentsSpan = {start: annotationSpan.start, end: annotationSpan.end-1};
            const newAnnotation: ast.AnnotationNode = {
                type: "annotation",
                span: annotationSpan,
                children: [{
                    type: "contents",
                    span: annotationContentsSpan,
                    children: [...afterValues, ...annotation.children[0].children],
                }, annotation.children[1]],
            }
            const constentsSpan = {start: node.span.start, end: values !== null ? values.span.start : -1};
            const contents: ast.ContentsNode = {
                type: "contents",
                span: constentsSpan,
                children: [...beforeValues],
            }
            const beforeAnnotation = values !== null ? [contents, values] as const : [] as const;
            return {type: "class-data", writeMethod: true, span: node.span, children: [...beforeAnnotation, annotation]}
        }
        case "class-data-no-wr": {
            const hasValues = children.length > 0 && children[children.length-1].type === "values";
            const values = hasValues ? children[children.length-1] : null;
            assert(values === null || values.type === "values");
            const before = children.slice(0, hasValues ? -1 : undefined);
            assert(before.every(c => c.type === "blockdata-sequence" || c.type === "object"));
            const contentsStart = node.span.start;
            const contentsEnd = before.length > 0 ? before[before.length-1].span.end : values !== null ? values.span.start : node.span.end;
            const contents: ast.ContentsNode = {
                type: "contents",
                span: {start: contentsStart, end: contentsEnd},
                children: before,
            }
            const valuesNodes = values !== null ? [values] as const : [] as const;
            return {type: "class-data", writeMethod: false, span: node.span, children: [
                contents, ...valuesNodes,
            ]}
        }
        case "object/exception": {
            assert(node.error !== undefined);
            assert(children.length === 2);
            const tc = children[0];
            const throwable = children[1];
            assert(tc.type === "tc" && tc.value === ObjectInputStream.TC_EXCEPTION);
            assert(throwable.type === "object" && (throwable.objectType === "new-object" || throwable.objectType === "prev-object"));
            return {type: "object", objectType: "exception", exceptionEpoch: -1, newEpoch: -1, span: node.span, children: [tc, throwable]}
        }
        case "annotation": {
            assert(children.length > 0);
            const contents = children.slice(0, -1);
            const tc = children[children.length-1];
            assert(contents.every(c => c.type === "blockdata-sequence" || c.type === "object"));
            assert(tc.type === "tc" && tc.value === ObjectInputStream.TC_ENDBLOCKDATA);
            return {type: "annotation", span: node.span, children: [{
                type: "contents", span: {start: node.span.start, end: tc.span.start}, children: contents,
            }, tc]}
        }
        case "fields": {
            assert(children.length > 0);
            const length = children[0];
            const fields = children.slice(1);
            assert(length.type === "primitive" && length.dataType === "short");
            assert(fields.every(f => f.type === "field-desc"));
            return {type: "fields", span: node.span, children: [length, ...fields]}
        }
        case "field": {
            assert(children.length >= 2);
            const typecode = children[0];
            const name = children[1];
            assert(typecode.type === "primitive" && typecode.dataType === "unsigned-byte");
            assert(name.type === "utf");
            const tcStr = String.fromCharCode(typecode.value);
            if (tcStr === "[" || tcStr === "L") {
                assert(children.length === 3);
                const className = children[2];
                assertStringNode(className);
                return {type: "field-desc", fieldType: "object", span: node.span, children: [typecode, name, className]}
            } else {
                assert(children.length === 2);
                return {type: "field-desc", fieldType: "primitive", span: node.span, children: [typecode, name]}
            }
        }
        case "values": {
            assert(children.every(c => c.type === "primitive" || c.type === "object"));
            return {type: "values", span: node.span, children: children}
        }
        default:
            throw new exc.InternalError();
    }
}

function assertDescNode(node: ast.Node): asserts node is ast.ClassDescNode {
    assert(
        node.type === "object" &&
        (node.objectType === "new-class-desc" || node.objectType === "null" || node.objectType === "prev-object")
    )
}

function assertStringNode(node: ast.Node): asserts node is ast.StringNode {
    assert(
        node.type === "object" &&
        (node.objectType === "new-string" || node.objectType === "prev-object")
    )
}
